import { evaluateStation, loadRouteSchedule } from "./alerts";
import type { AlertOutcome } from "./alerts";
import { removeRoute, seedRoutes, sortedRoutes, upsertRoute } from "./favorites";
import { GeofenceManager, type GeofenceTransition } from "./geofence";
import { showNotification } from "./notifier";
import {
  queryLocationPermission,
  queryNotificationPermission,
  requestLocationPermission,
  requestNotificationPermission,
} from "./permissions";
import { createDataProvider, type LiveFetchFn } from "./providers";
import type { TrainDataProvider } from "./providers/TrainDataProvider";
import { requireStation } from "./stations";
import { loadSettings, saveSettings } from "./settings";
import { loadJson, loadList, removeKey, saveJson, STORAGE_KEYS } from "./storage";
import type {
  AlertRecord,
  AlertSettings,
  FavoriteRoute,
  GeoStatus,
  PermissionKind,
  PositionFix,
} from "./types";

/**
 * Application store: favourites, settings, permission/geo runtime state and the
 * geofence engine wiring. Framework agnostic (useSyncExternalStore on top).
 */

export interface TrenesState {
  favorites: FavoriteRoute[];
  settings: AlertSettings;
  history: AlertRecord[];
  permissions: { location: PermissionKind; notification: PermissionKind };
  geo: GeoStatus;
  geoMessage: string | null;
  position: PositionFix | null;
  inside: string[];
  lastOutcomes: AlertOutcome[];
  hydrated: boolean;
}

const initialSettings = loadSettings();
const initialFavorites = (() => {
  const stored = loadList<FavoriteRoute>(STORAGE_KEYS.favorites, []);
  return stored.length ? stored : seedRoutes();
})();

const initialState: TrenesState = {
  favorites: sortedRoutes(initialFavorites),
  settings: initialSettings,
  history: loadList<AlertRecord>(STORAGE_KEYS.alerts, []),
  permissions: { location: "prompt", notification: "prompt" },
  geo: "off",
  geoMessage: null,
  position: null,
  inside: [],
  lastOutcomes: [],
  hydrated: true,
};

let state: TrenesState = initialState;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setState(patch: Partial<TrenesState>) {
  state = { ...state, ...patch };
  emit();
}

export function getTrenesState(): TrenesState {
  return state;
}

export function subscribeTrenes(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function persistFavorites() {
  saveJson(STORAGE_KEYS.favorites, state.favorites);
}

function persistSettings() {
  saveSettings(state.settings);
}

function persistHistory() {
  saveJson(STORAGE_KEYS.alerts, state.history.slice(0, 40));
}

/* -------------------------------------------------------------------------- */
/* Favourites                                                                  */
/* -------------------------------------------------------------------------- */

export function addFavorite(originId: string, destinationId: string): string | null {
  const result = upsertRoute(state.favorites, originId, destinationId);
  if (result.reason) return result.reason;
  setState({ favorites: sortedRoutes(result.routes) });
  persistFavorites();
  syncEngine();
  return null;
}

export function updateFavorite(id: string, patch: Partial<FavoriteRoute>) {
  setState({
    favorites: state.favorites.map((r) => (r.id === id ? { ...r, ...patch, id: r.id } : r)),
  });
  persistFavorites();
  syncEngine();
}

export function deleteFavorite(id: string) {
  setState({ favorites: removeRoute(state.favorites, id) });
  persistFavorites();
  syncEngine();
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                    */
/* -------------------------------------------------------------------------- */

export function updateSettings(patch: Partial<AlertSettings>) {
  const next: AlertSettings = { ...state.settings, ...patch };
  setState({ settings: next });
  persistSettings();
  syncEngine();
}

export function resetAlertHistory() {
  setState({ history: [], lastOutcomes: [] });
  saveJson(STORAGE_KEYS.alerts, []);
}

/* -------------------------------------------------------------------------- */
/* Data layer                                                                  */
/* -------------------------------------------------------------------------- */

let liveFetch: LiveFetchFn | null = null;

/** Wired by React from the Convex action; until then the app uses demo data. */
export function setLiveFetch(fn: LiveFetchFn | null) {
  liveFetch = fn;
}

export function getProvider(): TrainDataProvider {
  return createDataProvider({ mode: state.settings.dataSource, liveFetch });
}

export function loadScheduleForRoute(route: FavoriteRoute) {
  return loadRouteSchedule(getProvider(), route);
}

/* -------------------------------------------------------------------------- */
/* Geofence engine                                                             */
/* -------------------------------------------------------------------------- */

let engine: GeofenceManager | null = null;
const running = new Set<string>();

function targetsFromFavorites() {
  const seen = new Set<string>();
  const targets: { id: string; lat: number; lng: number }[] = [];
  for (const route of state.favorites) {
    if (!route.alerts) continue;
    const station = requireStationSafe(route.originId);
    if (!station || seen.has(station.id)) continue;
    seen.add(station.id);
    targets.push({ id: station.id, lat: station.lat, lng: station.lng });
  }
  return targets;
}

function requireStationSafe(id: string) {
  try {
    return requireStation(id);
  } catch {
    return null;
  }
}

function ensureEngine(): GeofenceManager {
  if (engine) return engine;
  engine = new GeofenceManager({
    onStatus: (status, message) => {
      setState({ geo: status, geoMessage: message ?? null });
      if (status === "permission-denied") {
        setState({ permissions: { ...state.permissions, location: "denied" } });
      }
    },
    onFix: (fix) => {
      setState({ position: fix });
    },
    onTransition: handleTransition,
  });
  return engine;
}

function handleTransition(transition: GeofenceTransition) {
  const inside = new Set(state.inside);
  if (transition.type === "enter" || transition.type === "dwell") inside.add(transition.stationId);
  if (transition.type === "exit") inside.delete(transition.stationId);
  if (inside.size !== state.inside.length) {
    setState({ inside: [...inside] });
  } else {
    setState({ inside: [...inside] });
  }

  const dwellSeconds = state.settings.dwellSeconds;
  if (transition.type === "enter" && dwellSeconds > 0) return; // wait for dwell
  if (transition.type === "exit") return;

  const reason = transition.type === "tick" ? "tick" : transition.type === "dwell" ? "dwell" : "enter";
  void runAlerts(transition.stationId, reason);
}

/** Runs the geofence → route → train → notification pipeline for one station. */
export async function runAlerts(
  stationId: string,
  reason: "enter" | "dwell" | "tick" | "test",
): Promise<AlertOutcome[]> {
  if (running.has(stationId) && reason !== "test") return [];
  running.add(stationId);
  try {
    const outcomes = await evaluateStation(
      {
        favorites: state.favorites,
        settings: state.settings,
        history: state.history,
        provider: getProvider(),
      },
      stationId,
      reason,
    );

    const records: AlertRecord[] = [];
    for (const outcome of outcomes) {
      if (outcome.status !== "notified" || !outcome.record) continue;
      const result = await showNotification({
        title: outcome.record.title,
        body: outcome.record.body,
        tag: outcome.record.trainKey,
        data: { stationId, routeId: outcome.routeId },
      });
      if (result === "shown") records.push(outcome.record);
    }

    setState({
      lastOutcomes: outcomes,
      history: records.length
        ? [...records.slice().reverse(), ...state.history].slice(0, 40)
        : state.history,
    });
    if (records.length) persistHistory();
    return outcomes;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setState({
      lastOutcomes: [
        {
          stationId,
          routeId: null,
          status: "error",
          train: null,
          record: null,
          detail: message,
        },
      ],
    });
    return [];
  } finally {
    running.delete(stationId);
  }
}

/** Recomputes targets/radius and starts or stops the GPS watch. */
export function syncEngine() {
  const instance = ensureEngine();
  instance.configure({
    radiusM: state.settings.radiusM,
    dwellSeconds: state.settings.dwellSeconds,
  });
  instance.setTargets(targetsFromFavorites());

  const allowed =
    state.settings.alertsEnabled &&
    state.permissions.location !== "denied" &&
    state.permissions.location !== "unsupported";

  if (allowed) instance.start();
  else instance.stop();
}

/* -------------------------------------------------------------------------- */
/* Permissions (progressive flow)                                              */
/* -------------------------------------------------------------------------- */

export async function refreshPermissions() {
  const [location, notification] = await Promise.all([
    queryLocationPermission(),
    queryNotificationPermission(),
  ]);
  setState({ permissions: { location, notification } });
  syncEngine();
}

/** Step 1 of the flow: ask for location, then start the geofence watch. */
export async function enableAlerts() {
  updateSettings({ alertsEnabled: true });
  const location = await requestLocationPermission();
  setState({ permissions: { ...state.permissions, location } });
  syncEngine();
  return location;
}

export async function requestNotifications() {
  const notification = await requestNotificationPermission();
  setState({ permissions: { ...state.permissions, notification } });
  return notification;
}

/* -------------------------------------------------------------------------- */
/* Test mode                                                                   */
/* -------------------------------------------------------------------------- */

export function fixAtStation(stationId: string): PositionFix {
  const station = requireStation(stationId);
  return { lat: station.lat, lng: station.lng, accuracy: 25, at: Date.now(), source: "test" };
}

/** A point far enough from every station to leave every geofence. */
export function fixFarAway(): PositionFix {
  return { lat: -34.6037, lng: -58.3815, accuracy: 30, at: Date.now(), source: "test" };
}

export function simulatePosition(fix: PositionFix) {
  ensureEngine().injectFix(fix);
  setState({ position: fix });
}

/** Single real GPS fix ("Cerca de mí" / diagnostics). Runs the same engine. */
export async function captureSingleFix(): Promise<PositionFix> {
  const instance = ensureEngine();
  const fix = await instance.requestSingleFix();
  instance.injectFix(fix);
  return fix;
}

export function simulateExit() {
  ensureEngine().reset();
  setState({ inside: [] });
}

export function clearSimulatedPosition() {
  setState({ position: null });
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                        */
/* -------------------------------------------------------------------------- */

export function clearAllData() {
  removeKey(STORAGE_KEYS.favorites);
  removeKey(STORAGE_KEYS.settings);
  removeKey(STORAGE_KEYS.alerts);
  setState({
    favorites: seedRoutes(),
    settings: loadSettings(),
    history: [],
    lastOutcomes: [],
  });
  syncEngine();
}
