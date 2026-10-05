import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { buildQuery } from "@/lib/trenes/alerts";
import {
  getTrenesState,
  getProvider,
  refreshPermissions,
  subscribeTrenes,
  syncEngine,
  type TrenesState,
} from "@/lib/trenes/store";
import { computeUpcomingTrains } from "@/lib/trenes/nextTrain";
import { deriveAlertStatus, type AlertStatus } from "@/lib/trenes/permissions";
import { getStation } from "@/lib/trenes/stations";
import { diaForNow, nowArtMinutes } from "@/lib/trenes/time";
import type { FavoriteRoute, ScheduleBundle, UpcomingTrain } from "@/lib/trenes/types";

export function useTrenesState(): TrenesState {
  return useSyncExternalStore(subscribeTrenes, getTrenesState, getTrenesState);
}

/** Re-renders on an interval so countdowns stay fresh without refetching. */
export function useTicker(intervalMs = 30_000): number {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return tick;
}

export interface RouteView {
  route: FavoriteRoute;
  originName: string;
  destinationName: string;
  sentidoLabel: string;
  lineLabel: string;
  trains: UpcomingTrain[];
  nextTrain: UpcomingTrain | null;
  loading: boolean;
  error: string | null;
  sourceLabel: string;
  degradedReason?: string;
  notices: string[];
  valid: boolean;
}

interface BundleSlot {
  bundle: ScheduleBundle | null;
  error: string | null;
}

/**
 * Loads schedules for every favourite route, refreshes them periodically and
 * recomputes the countdowns on every ticker tick.
 */
export function useRouteViews(now: number): RouteView[] {
  const state = useTrenesState();
  const [slots, setSlots] = useState<Record<string, BundleSlot>>({});

  const routeSignature = state.favorites
    .map((r) => `${r.id}:${r.originId}-${r.destinationId}`)
    .join("|");
  const mode = state.settings.dataSource;

  useEffect(() => {
    const routes = state.favorites;
    let cancelled = false;

    const load = async () => {
      const provider = getProvider();
      const entries = await Promise.all(
        routes.map(async (route): Promise<[string, BundleSlot]> => {
          const origin = getStation(route.originId);
          const destination = getStation(route.destinationId);
          if (!origin || !destination || origin.id === destination.id) {
            return [route.id, { bundle: null, error: "Recorrido inválido." }];
          }
          try {
            const bundle = await provider.getSchedule(buildQuery(origin, destination));
            return [route.id, { bundle, error: null }];
          } catch (error) {
            return [
              route.id,
              { bundle: null, error: error instanceof Error ? error.message : String(error) },
            ];
          }
        }),
      );
      if (!cancelled) setSlots(Object.fromEntries(entries));
    };

    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeSignature, mode]);

  return useMemo(() => {
    const nowMin = nowArtMinutes(now);
    return state.favorites.map((route) => {
      const origin = getStation(route.originId);
      const destination = getStation(route.destinationId);
      const slot = slots[route.id];
      const valid = Boolean(origin && destination && origin.id !== destination.id);

      const base: RouteView = {
        route,
        originName: origin?.name ?? route.originId,
        destinationName: destination?.name ?? route.destinationId,
        sentidoLabel: "—",
        lineLabel: "Línea Sarmiento",
        trains: [],
        nextTrain: null,
        loading: !slot,
        error: slot?.error ?? null,
        sourceLabel: slot?.bundle?.sourceLabel ?? "—",
        degradedReason: slot?.bundle?.degradedReason,
        notices: slot?.bundle?.notices ?? [],
        valid,
      };

      if (!valid || !origin || !destination || !slot?.bundle) return base;

      const trains = computeUpcomingTrains({
        bundle: slot.bundle,
        origin,
        destination,
        nowMin,
        limit: 4,
      });

      return {
        ...base,
        trains,
        nextTrain: trains[0] ?? null,
        notices: slot.bundle.notices,
        sourceLabel: slot.bundle.sourceLabel,
        degradedReason: slot.bundle.degradedReason,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.favorites, slots, now]);
}

/**
 * Departure board for stations without a saved trip: next train toward each
 * terminal, so "Cerca de mí" can still be useful.
 */
export function useDepartureBoard(
  stationIds: string[],
  now: number,
): Record<string, ScheduleBundle | null> {
  const [bundles, setBundles] = useState<Record<string, ScheduleBundle | null>>({});
  const mode = useTrenesState().settings.dataSource;
  const key = stationIds.join(",");

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) {
      setBundles({});
      return;
    }
    let cancelled = false;
    const provider = getProvider();

    const load = async () => {
      const entries = await Promise.all(
        ids.flatMap((stationId) => {
          const station = getStation(stationId);
          if (!station) return [];
          return (["Once", "Moreno"] as const).map(async (sentido) => {
            const destinationId = sentido === "Once" ? "once" : "moreno";
            const boardKey = `${stationId}:${sentido}`;
            try {
              const bundle = await provider.getSchedule({
                originId: stationId,
                destinationId,
                sentido,
                dia: diaForNow(),
              });
              return [boardKey, bundle] as const;
            } catch {
              return [boardKey, null] as const;
            }
          });
        }),
      );
      if (!cancelled) setBundles(Object.fromEntries(entries));
    };

    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, mode]);

  return bundles;
}

/** Next train toward a terminal for one departure-board cell. */
export function departureBoardTrain(
  bundle: ScheduleBundle | null,
  stationId: string,
  sentido: "Once" | "Moreno",
  nowMin: number,
): UpcomingTrain | null {
  const station = getStation(stationId);
  if (!station || !bundle) return null;
  const destination = getStation(sentido === "Once" ? "once" : "moreno");
  if (!destination) return null;
  const trains = computeUpcomingTrains({
    bundle,
    origin: station,
    destination,
    nowMin,
    limit: 1,
  });
  return trains[0] ?? null;
}

/** Starts the geofence engine once and re-checks permissions on tab focus. */
export function useTrenesSync() {
  useEffect(() => {
    syncEngine();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshPermissions();
        syncEngine();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, []);
}

export function useAlertStatus(): AlertStatus {
  const state = useTrenesState();
  return deriveAlertStatus({
    alertsEnabled: state.settings.alertsEnabled,
    location: state.permissions.location,
    notification: state.permissions.notification,
    geo: state.geo,
  });
}
