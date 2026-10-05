import type { LineId, Sentido, Station } from "./types";

/**
 * Station repository for the prototype (Línea Sarmiento, Once ⇄ Moreno).
 * Coordinates are approximate published positions of the station buildings;
 * they only drive the proximity radius and the schematic map.
 *
 * `segmentToNextMin` is the published travel time to the following station and
 * is only used by the demo timetable generator.
 */
const SEGMENTS = [6, 4, 3, 3, 4, 3, 4, 4, 4, 5, 5, 4, 3, 3, 4];

type Seed = [id: string, name: string, sourceName: string, lat: number, lng: number];

const SEEDS: Seed[] = [
  ["once", "Once", "Once", -34.6036, -58.412],
  ["caballito", "Caballito", "Caballito", -34.6183, -58.4414],
  ["flores", "Flores", "Flores", -34.6264, -58.4634],
  ["floresta", "Floresta", "Floresta", -34.6334, -58.4783],
  ["villa-luro", "Villa Luro", "Villa Luro", -34.6437, -58.5033],
  ["liniers", "Liniers", "Liniers", -34.6485, -58.5194],
  ["ciudadela", "Ciudadela", "Ciudadela", -34.6574, -58.5317],
  ["ramos-mejia", "Ramos Mejía", "Ramos Mejía", -34.6667, -58.5594],
  ["haedo", "Haedo", "Haedo", -34.6767, -58.5867],
  ["moron", "Morón", "Morón", -34.6937, -58.6133],
  ["castelar", "Castelar", "Castelar", -34.7037, -58.6494],
  ["ituzaingo", "Ituzaingó", "Ituzaingó", -34.7157, -58.6674],
  ["san-antonio-de-padua", "San Antonio de Padua", "S. A. de Padua", -34.726, -58.708],
  ["merlo", "Merlo", "Merlo", -34.7356, -58.7303],
  ["paso-del-rey", "Paso del Rey", "Paso del Rey", -34.7486, -58.7617],
  ["moreno", "Moreno", "Moreno", -34.7623, -58.7892],
];

export const SARMIENTO_STATIONS: Station[] = SEEDS.map((seed, index) => ({
  id: seed[0],
  name: seed[1],
  sourceName: seed[2],
  line: "sarmiento" as LineId,
  lat: seed[3],
  lng: seed[4],
  order: index,
  segmentToNextMin: SEGMENTS[index] ?? 4,
}));

const BY_ID = new Map(SARMIENTO_STATIONS.map((s) => [s.id, s]));

export function getStation(id: string | null | undefined): Station | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

export function requireStation(id: string): Station {
  const station = getStation(id);
  if (!station) throw new Error(`Estación desconocida: ${id}`);
  return station;
}

/** Case/accent/abbreviation tolerant lookup, used by the "cerca de mí" data. */
export function findStationByName(name: string): Station | null {
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!normalized) return null;
  return (
    SARMIENTO_STATIONS.find((s) => {
      const candidates = [s.name, s.sourceName].map((c) =>
        c
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, " ")
          .trim(),
      );
      return candidates.some(
        (c) => c === normalized || c.includes(normalized) || normalized.includes(c),
      );
    }) ?? null
  );
}

export function stationOptions(): { value: string; label: string }[] {
  return SARMIENTO_STATIONS.map((s) => ({ value: s.id, label: s.name }));
}

/** Stations strictly between origin and destination, in travel order. */
export function stationsBetween(origin: Station, destination: Station): Station[] {
  const [from, to] =
    origin.order < destination.order ? [origin, destination] : [destination, origin];
  return SARMIENTO_STATIONS.filter((s) => s.order > from.order && s.order < to.order);
}

/** Cumulative travel time (minutes) from one station to another. */
export function travelMinutes(origin: Station, destination: Station): number {
  if (origin.id === destination.id) return 0;
  const ascending = origin.order < destination.order;
  const [from, to] = ascending ? [origin, destination] : [destination, origin];
  let total = 0;
  for (const station of SARMIENTO_STATIONS) {
    if (station.order > from.order && station.order <= to.order) {
      total += station.segmentToNextMin;
    }
  }
  return total;
}

export interface Direction {
  sentido: Sentido;
  /** "hacia Once" */
  label: string;
  terminal: Station;
  invalid: boolean;
}

/**
 * origin + destination → sentido. The user never picks a direction manually:
 * it is derived from where the two stations sit on the line.
 * Merlo → Liniers ⇒ hacia Once.  Liniers → Merlo ⇒ hacia Moreno.
 */
export function resolveDirection(origin: Station, destination: Station): Direction {
  if (origin.id === destination.id) {
    return { sentido: "Once", label: "mismo origen y destino", terminal: origin, invalid: true };
  }
  const sentido: Sentido = destination.order < origin.order ? "Once" : "Moreno";
  const terminal = sentido === "Once" ? requireStation("once") : requireStation("moreno");
  return { sentido, label: `hacia ${sentido}`, terminal, invalid: false };
}

/** Distance in metres between two WGS84 points (haversine). */
export function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface StationDistance {
  station: Station;
  meters: number;
}

export function stationsByDistance(
  lat: number,
  lng: number,
  limit = 8,
): StationDistance[] {
  return SARMIENTO_STATIONS.map((station) => ({
    station,
    meters: haversineMeters(lat, lng, station.lat, station.lng),
  }))
    .sort((a, b) => a.meters - b.meters)
    .slice(0, limit);
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}
