import { haversineMeters } from "./stations";
import type { GeoStatus, PositionFix } from "./types";

/**
 * GeofenceManager.
 *
 * Mirrors the semantics of Android's GeofencingClient in a portable way:
 *  - only the stations that are origins of active favourites are watched
 *  - ENTER / DWELL / EXIT transitions with hysteresis so GPS jitter does not
 *    flip the state
 *  - DWELL (optional) avoids firing while simply driving past a station
 *  - periodic TICKs while inside so "next train in < 10 min" rules can fire
 *  - transitions can be injected by the test mode without a physical GPS fix
 *
 * On Android this maps 1:1 to GeofencingClient.addGeofences + the
 * GEOFENCE_TRANSITION_* broadcast receiver (see docs/ANDROID_PORT.md).
 */

export interface GeofenceTarget {
  id: string;
  lat: number;
  lng: number;
}

export type GeofenceTransitionType = "enter" | "dwell" | "exit" | "tick";

export interface GeofenceTransition {
  type: GeofenceTransitionType;
  stationId: string;
  meters: number;
  at: number;
}

export interface GeofenceEvents {
  onStatus: (status: GeoStatus, message?: string) => void;
  onFix: (fix: PositionFix) => void;
  onTransition: (transition: GeofenceTransition) => void;
}

interface StationState {
  inside: boolean;
  since: number;
  dwellFired: boolean;
}

const HYSTERESIS_M = 75;
const TICK_MS = 45_000;
const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 30_000,
  maximumAge: 10_000,
};

export class GeofenceManager {
  private watchId: number | null = null;
  private targets = new Map<string, GeofenceTarget>();
  private states = new Map<string, StationState>();
  private dwellTimers = new Map<string, number>();
  private tickTimer: number | null = null;
  private radiusM = 500;
  private dwellSeconds = 15;
  private lastFix: PositionFix | null = null;
  private started = false;
  private readonly events: GeofenceEvents;

  constructor(events: GeofenceEvents) {
    this.events = events;
  }

  get position(): PositionFix | null {
    return this.lastFix;
  }

  get status(): GeoStatus {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return "unsupported";
    if (!this.started) return "off";
    if (this.lastFix) return "watching";
    return "starting";
  }

  insideStations(): string[] {
    return [...this.states.entries()].filter(([, s]) => s.inside).map(([id]) => id);
  }

  configure(options: { radiusM?: number; dwellSeconds?: number }): void {
    if (options.radiusM !== undefined && options.radiusM !== this.radiusM) {
      this.radiusM = options.radiusM;
      // Radius changed: re-evaluate the world on the next fix.
      for (const state of this.states.values()) {
        state.inside = false;
        state.dwellFired = false;
      }
    }
    if (options.dwellSeconds !== undefined) this.dwellSeconds = options.dwellSeconds;
  }

  setTargets(targets: GeofenceTarget[]): void {
    const next = new Map(targets.map((t) => [t.id, t]));
    for (const id of [...this.targets.keys()]) {
      if (!next.has(id)) {
        this.clearDwell(id);
        this.states.delete(id);
      }
    }
    this.targets = next;
    if (this.lastFix) this.evaluate(this.lastFix.lat, this.lastFix.lng, this.lastFix.accuracy, this.lastFix.at);
  }

  start(): void {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      this.events.onStatus("unsupported");
      return;
    }
    if (this.watchId !== null) return;
    this.started = true;
    this.events.onStatus("starting");
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const fix: PositionFix = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy ?? 0,
          at: position.timestamp || Date.now(),
          source: "gps",
        };
        this.applyFix(fix);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          this.events.onStatus("permission-denied", error.message);
        } else {
          this.events.onStatus("error", error.message);
        }
      },
      WATCH_OPTIONS,
    );
    this.startTicks();
  }

  stop(): void {
    if (this.watchId !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(this.watchId);
    }
    this.watchId = null;
    this.started = false;
    this.stopTicks();
    for (const id of [...this.dwellTimers.keys()]) this.clearDwell(id);
    this.states.clear();
    this.events.onStatus("off");
  }

  /** Single fix used by "Cerca de mí" and by the permission flow. */
  requestSingleFix(): Promise<PositionFix> {
    return new Promise((resolve, reject) => {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        reject(new Error("Geolocalización no soportada"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const fix: PositionFix = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy ?? 0,
            at: position.timestamp || Date.now(),
            source: "gps",
          };
          resolve(fix);
        },
        (error) => reject(new Error(error.message || "No se pudo obtener la ubicación")),
        WATCH_OPTIONS,
      );
    });
  }

  /** Test mode entry point: runs the exact same state machine as a real fix. */
  injectFix(fix: PositionFix): void {
    this.applyFix(fix);
  }

  /** Leaves every zone (used by "simular salida" and by reset). */
  reset(): void {
    for (const id of [...this.states.keys()]) {
      const state = this.states.get(id);
      if (state?.inside) {
        state.inside = false;
        state.dwellFired = false;
        this.clearDwell(id);
        this.events.onTransition({ type: "exit", stationId: id, meters: Number.POSITIVE_INFINITY, at: Date.now() });
      }
    }
  }

  private applyFix(fix: PositionFix): void {
    this.lastFix = fix;
    this.events.onFix(fix);
    this.events.onStatus("watching");
    this.evaluate(fix.lat, fix.lng, fix.accuracy, fix.at);
  }

  private evaluate(lat: number, lng: number, _accuracy: number, at: number): void {
    for (const [id, target] of this.targets) {
      const meters = haversineMeters(lat, lng, target.lat, target.lng);
      const state = this.states.get(id) ?? { inside: false, since: 0, dwellFired: false };
      this.states.set(id, state);

      if (!state.inside && meters <= this.radiusM) {
        state.inside = true;
        state.since = at;
        state.dwellFired = false;
        this.events.onTransition({ type: "enter", stationId: id, meters, at });
        this.scheduleDwell(id, at);
      } else if (state.inside && meters > this.radiusM + HYSTERESIS_M) {
        state.inside = false;
        state.dwellFired = false;
        state.since = 0;
        this.clearDwell(id);
        this.events.onTransition({ type: "exit", stationId: id, meters, at });
      }
    }
  }

  private scheduleDwell(stationId: string, at: number): void {
    this.clearDwell(stationId);
    if (this.dwellSeconds <= 0) return;
    const handle = window.setTimeout(() => {
      this.dwellTimers.delete(stationId);
      const state = this.states.get(stationId);
      if (!state?.inside || state.dwellFired) return;
      state.dwellFired = true;
      this.events.onTransition({
        type: "dwell",
        stationId,
        meters: this.lastFix
          ? haversineMeters(this.lastFix.lat, this.lastFix.lng, this.targets.get(stationId)!.lat, this.targets.get(stationId)!.lng)
          : 0,
        at: Date.now(),
      });
    }, this.dwellSeconds * 1000);
    this.dwellTimers.set(stationId, handle);
    void at;
  }

  private clearDwell(stationId: string): void {
    const handle = this.dwellTimers.get(stationId);
    if (handle !== undefined) {
      window.clearTimeout(handle);
      this.dwellTimers.delete(stationId);
    }
  }

  private startTicks(): void {
    this.stopTicks();
    this.tickTimer = window.setInterval(() => {
      const now = Date.now();
      for (const [id, state] of this.states) {
        if (!state.inside) continue;
        if (this.dwellSeconds > 0 && !state.dwellFired) continue;
        const meters = this.lastFix
          ? haversineMeters(
              this.lastFix.lat,
              this.lastFix.lng,
              this.targets.get(id)?.lat ?? 0,
              this.targets.get(id)?.lng ?? 0,
            )
          : 0;
        this.events.onTransition({ type: "tick", stationId: id, meters, at: now });
      }
    }, TICK_MS);
  }

  private stopTicks(): void {
    if (this.tickTimer !== null) {
      window.clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }
}
