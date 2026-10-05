import type { DataSourceMode, ScheduleBundle, ScheduleQuery } from "../types";
import { demoProvider } from "./demo";
import { createLiveProvider } from "./live";
import type { LiveFetchFn, TrainDataProvider } from "./TrainDataProvider";

export type { TrainDataProvider, LiveFetchFn, LiveFetchArgs, LiveScheduleDto } from "./TrainDataProvider";

const LIVE_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 80;

interface CacheSlot {
  bundle: ScheduleBundle;
  at: number;
}

const cache = new Map<string, CacheSlot>();

function cacheKey(mode: DataSourceMode, query: ScheduleQuery): string {
  return `${mode}|${query.originId}|${query.destinationId}|${query.sentido}|${query.dia}`;
}

function read(key: string): ScheduleBundle | null {
  const slot = cache.get(key);
  if (!slot) return null;
  const ttl = slot.bundle.source === "demo" ? Number.POSITIVE_INFINITY : LIVE_TTL_MS;
  if (Date.now() - slot.at > ttl) {
    cache.delete(key);
    return null;
  }
  return slot.bundle;
}

function write(key: string, bundle: ScheduleBundle) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { bundle, at: Date.now() });
}

export function invalidateScheduleCache() {
  cache.clear();
}

/** Synchronous read for first paint while the network request runs. */
export function peekSchedule(
  mode: DataSourceMode,
  query: ScheduleQuery,
): ScheduleBundle | null {
  return read(cacheKey(mode, query));
}

/**
 * Factory that honours the configured data source mode:
 *  - "demo": always labelled demo data
 *  - "live": real source, errors propagate to the UI
 *  - "auto": try the real source, fall back to clearly-labelled demo data
 */
export function createDataProvider(options: {
  mode: DataSourceMode;
  liveFetch: LiveFetchFn | null;
}): TrainDataProvider {
  const { mode, liveFetch } = options;
  const live = liveFetch ? createLiveProvider(liveFetch) : null;
  const key = (query: ScheduleQuery) => cacheKey(mode, query);

  if (mode === "demo") {
    return {
      id: "demo",
      label: "MODO DEMO",
      async getSchedule(query) {
        const cached = read(key(query));
        if (cached) return cached;
        const bundle = await demoProvider.getSchedule(query);
        write(key(query), bundle);
        return bundle;
      },
    };
  }

  return {
    id: mode === "live" ? "live" : (live?.id ?? "demo"),
    label: mode === "live" ? "horariostrenes.com.ar" : "auto",
    async getSchedule(query) {
      const cached = read(key(query));
      if (cached) return cached;

      if (!live) {
        const bundle = await demoProvider.getSchedule(query);
        return {
          ...bundle,
          degradedReason: "Esperando la conexión con la fuente de horarios…",
        };
      }

      try {
        const bundle = await live.getSchedule(query);
        write(key(query), bundle);
        return bundle;
      } catch (error) {
        if (mode === "live") throw error;
        const message = error instanceof Error ? error.message : String(error);
        const fallback = await demoProvider.getSchedule(query);
        const degraded: ScheduleBundle = {
          ...fallback,
          degradedReason: message,
        };
        write(key(query), degraded);
        return degraded;
      }
    },
  };
}
