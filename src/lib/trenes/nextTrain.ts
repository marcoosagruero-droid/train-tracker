import type { Station } from "./types";
import { travelMinutes } from "./stations";
import { parseHhmm, nowArtMinutes, minutesUntil } from "./time";
import type { ScheduleBundle, ScheduleEntry, ServiceStatus, UpcomingTrain } from "./types";

const STATUS_UNKNOWN: ServiceStatus = {
  kind: "unknown",
  label: "Información no disponible",
};

function buildKey(originId: string, destinationId: string, departureMin: number): string {
  return `${originId}->${destinationId}@${departureMin}`;
}

/**
 * Turns a provider bundle into concrete upcoming trains for one trip.
 * Nothing is invented: when the source has no arrival time for the requested
 * destination the arrival stays `null` and the UI prints
 * "Información no disponible".
 */
export function computeUpcomingTrains(options: {
  bundle: ScheduleBundle;
  origin: Station;
  destination: Station;
  nowMin?: number;
  limit?: number;
  /** Skip trains already closer than this (negative = keep, e.g. boarding). */
  horizonHours?: number;
}): UpcomingTrain[] {
  const { bundle, origin, destination, nowMin = nowArtMinutes(), limit = 6 } = options;
  const hasNotice = bundle.notices.length > 0;

  const trains: UpcomingTrain[] = [];

  for (const entry of bundle.entries) {
    const departureMin = parseHhmm(entry.departure);
    if (departureMin === null) continue;
    const minutesAway = minutesUntil(departureMin, nowMin);
    if (minutesAway < 0) continue;

    const arrivalMin = parseHhmm(entry.arrival);
    const arrivalMinutesAway =
      arrivalMin === null ? null : minutesUntil(arrivalMin, nowMin);

    trains.push({
      key: buildKey(origin.id, destination.id, departureMin),
      departureMin,
      arrivalMin,
      minutesAway,
      arrivalMinutesAway,
      originName: origin.name,
      destinationName: destination.name,
      sentido: options.destination.order < options.origin.order ? "Once" : "Moreno",
      status: hasNotice
        ? { kind: "notice", label: "Servicio con avisos" }
        : STATUS_UNKNOWN,
    });
  }

  trains.sort((a, b) => a.minutesAway - b.minutesAway);

  const seen = new Set<number>();
  const deduped = trains.filter((t) => {
    if (seen.has(t.departureMin)) return false;
    seen.add(t.departureMin);
    return true;
  });

  return deduped.slice(0, limit);
}

/** The single train a notification should talk about. */
export function nextTrainFor(
  bundle: ScheduleBundle,
  origin: Station,
  destination: Station,
  nowMin?: number,
): UpcomingTrain | null {
  const [first] = computeUpcomingTrains({ bundle, origin, destination, nowMin, limit: 1 });
  return first ?? null;
}

/** Used by the demo provider and by tests: build entries from absolute minutes. */
export function entryFromMinutes(
  departureMin: number,
  arrivalMin: number | null,
  originName: string,
  destinationName: string | null,
): ScheduleEntry {
  const pad = (m: number) => {
    const normalized = ((m % 1440) + 1440) % 1440;
    return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
  };
  return {
    departure: pad(departureMin),
    arrival: arrivalMin === null ? null : pad(arrivalMin),
    originStation: originName,
    destinationStation: destinationName,
  };
}

/** Total travel time helper re-exported for the UI. */
export function tripDurationMinutes(origin: Station, destination: Station): number {
  return travelMinutes(origin, destination);
}
