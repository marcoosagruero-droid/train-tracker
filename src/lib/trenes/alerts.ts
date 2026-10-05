import { computeUpcomingTrains, nextTrainFor } from "./nextTrain";
import { diaForNow, formatHhmm, nowArtMinutes, spokenRemaining } from "./time";
import { getStation, requireStation, resolveDirection } from "./stations";
import { shouldAlert } from "./settings";
import type {
  AlertRecord,
  AlertSettings,
  FavoriteRoute,
  ScheduleQuery,
  Sentido,
  Station,
  UpcomingTrain,
} from "./types";
import type { TrainDataProvider } from "./providers/TrainDataProvider";
import type { ScheduleBundle } from "./types";

/** NextTrainCalculator + notification policy in one place. */

export interface RouteSchedule {
  route: FavoriteRoute;
  origin: Station;
  destination: Station;
  sentido: Sentido;
  query: ScheduleQuery;
  bundle: ScheduleBundle;
  trains: UpcomingTrain[];
  nextTrain: UpcomingTrain | null;
}

export function buildQuery(origin: Station, destination: Station): ScheduleQuery {
  return {
    originId: origin.id,
    destinationId: destination.id,
    sentido: resolveDirection(origin, destination).sentido,
    dia: diaForNow(),
  };
}

/** Loads and computes the upcoming trains for one favourite route. */
export async function loadRouteSchedule(
  provider: TrainDataProvider,
  route: FavoriteRoute,
  options: { nowMin?: number; limit?: number } = {},
): Promise<RouteSchedule | null> {
  const origin = getStation(route.originId);
  const destination = getStation(route.destinationId);
  if (!origin || !destination || origin.id === destination.id) return null;

  const query = buildQuery(origin, destination);
  const bundle = await provider.getSchedule(query);
  const trains = computeUpcomingTrains({
    bundle,
    origin,
    destination,
    nowMin: options.nowMin,
    limit: options.limit ?? 4,
  });

  return {
    route,
    origin,
    destination,
    sentido: resolveDirection(origin, destination).sentido,
    query,
    bundle,
    trains,
    nextTrain: trains[0] ?? null,
  };
}

export function buildNotification(train: UpcomingTrain): { title: string; body: string; tag: string } {
  const route = `${train.originName} → ${train.destinationName}`;
  return {
    title: `🚆 Cerca de ${train.originName}`,
    body:
      `Estás cerca de ${train.originName}.\n` +
      `${route}\n` +
      `${spokenRemaining(train.minutesAway)}, a las ${formatHhmm(train.departureMin)}.`,
    tag: train.key,
  };
}

export type AlertOutcomeStatus =
  | "notified"
  | "suppressed-cooldown"
  | "suppressed-rule"
  | "suppressed-duplicate"
  | "no-route"
  | "no-data"
  | "error";

export interface AlertOutcome {
  stationId: string;
  routeId: string | null;
  status: AlertOutcomeStatus;
  train: UpcomingTrain | null;
  record: AlertRecord | null;
  detail: string;
}

export interface AlertContext {
  favorites: FavoriteRoute[];
  settings: AlertSettings;
  history: AlertRecord[];
  provider: TrainDataProvider;
}

/**
 * Runs the full pipeline described in the brief:
 * geofence → favourite routes whose ORIGIN is that station → direction →
 * next train → rules → cooldown → notification.
 *
 * Returns one outcome per evaluated route so the test screen can show exactly
 * why an alert did or did not fire.
 */
export async function evaluateStation(
  context: AlertContext,
  stationId: string,
  reason: "enter" | "dwell" | "tick" | "test",
): Promise<AlertOutcome[]> {
  const { settings, history, provider } = context;
  const routes = context.favorites.filter(
    (route) => route.originId === stationId && route.alerts,
  );

  if (!settings.alertsEnabled && reason !== "test") {
    return routes.map((route) => ({
      stationId,
      routeId: route.id,
      status: "no-route",
      train: null,
      record: null,
      detail: "Alertas desactivadas en Ajustes.",
    }));
  }

  if (routes.length === 0) {
    return [
      {
        stationId,
        routeId: null,
        status: "no-route",
        train: null,
        record: null,
        detail: "Ningún recorrido favorito tiene origen en esta estación.",
      },
    ];
  }

  const now = Date.now();
  const nowMin = nowArtMinutes(now);
  const outcomes: AlertOutcome[] = [];

  for (const route of routes) {
    let schedule: RouteSchedule | null = null;
    try {
      schedule = await loadRouteSchedule(provider, route, { nowMin, limit: 1 });
    } catch (error) {
      outcomes.push({
        stationId,
        routeId: route.id,
        status: "error",
        train: null,
        record: null,
        detail: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    if (!schedule?.nextTrain) {
      outcomes.push({
        stationId,
        routeId: route.id,
        status: "no-data",
        train: null,
        record: null,
        detail: "No hay datos de horarios disponibles para ese recorrido.",
      });
      continue;
    }

    const train = schedule.nextTrain;

    if (!shouldAlert({ reason, minutesAway: train.minutesAway, rules: settings.rules })) {
      outcomes.push({
        stationId,
        routeId: route.id,
        status: "suppressed-rule",
        train,
        record: null,
        detail: `No se cumplió ninguna condición de aviso (próximo tren en ${train.minutesAway} min).`,
      });
      continue;
    }

    if (reason !== "test") {
      const duplicate = history.some((r) => r.trainKey === train.key);
      if (duplicate) {
        outcomes.push({
          stationId,
          routeId: route.id,
          status: "suppressed-duplicate",
          train,
          record: null,
          detail: "Ya se avisó por ese tren.",
        });
        continue;
      }

      const cooldownMs = settings.cooldownMin * 60_000;
      const inCooldown = history.some(
        (r) =>
          r.stationId === stationId &&
          r.routeId === route.id &&
          now - r.at < cooldownMs,
      );
      if (cooldownMs > 0 && inCooldown) {
        outcomes.push({
          stationId,
          routeId: route.id,
          status: "suppressed-cooldown",
          train,
          record: null,
          detail: `Enfriamiento activo: no se repite la alerta durante ${settings.cooldownMin} min.`,
        });
        continue;
      }
    }

    const { title, body, tag } = buildNotification(train);
    const record: AlertRecord = {
      id: `${stationId}|${route.id}|${train.departureMin}|${now}`,
      stationId,
      routeId: route.id,
      at: now,
      trainKey: train.key,
      departureMin: train.departureMin,
      minutesAway: train.minutesAway,
      reason,
      title,
      body,
    };

    outcomes.push({
      stationId,
      routeId: route.id,
      status: "notified",
      train,
      record,
      detail: title,
    });
  }

  return outcomes;
}

/** Convenience for the UI: distance info is added by the caller. */
export function originStationOf(route: FavoriteRoute): Station | null {
  return getStation(route.originId);
}

export function requireOriginStation(route: FavoriteRoute): Station | null {
  try {
    return requireStation(route.originId);
  } catch {
    return null;
  }
}
