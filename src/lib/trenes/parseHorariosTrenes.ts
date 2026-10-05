/**
 * Parser for https://www.horariostrenes.com.ar/horarios-tren-sarmiento
 *
 * Findings from the source investigation (see docs/DATA_SOURCE.md):
 *  - The site is server rendered HTML. There is no JSON/XHR endpoint for the
 *    timetable itself: a plain `GET` with query params renders the results.
 *  - Contract discovered:
 *      GET /horariostrenes.com.ar/horarios-tren-sarmiento
 *            ?estacion=<Estación>&sentido=<Once|Moreno>&dia=<habil|sab|domFer>
 *  - Result markup:
 *      <div class="nextTrains">
 *        <div class="horarioItem">
 *          <span class="horarioItemHora">10:11 hs</span>
 *          <span class="horarioItemTexto">En 3 minutos</span>
 *          <div class="detalle">
 *            <div class="detalleItem stationBefore">10:00: Moreno</div>
 *            <div class="detalleItem current">10:11: Merlo</div>
 *            <div class="detalleItem">10:15: S. A. de Padua</div>
 *            ...
 *          </div>
 *        </div>
 *      </div>
 *  - `robots.txt` disallows /api/sugerencias-de-estaciones and /buscar-estacion;
 *    those are NOT used here. Only the public timetable page is requested, and
 *    only through our own proxy with client side caching.
 *
 * This module is intentionally free of browser/Convex imports so it can run in
 * the Convex "use node" action, in the browser bundle, and in local scripts.
 */

export interface RawStop {
  time: string;
  station: string;
  isOrigin: boolean;
}

export interface RawTrain {
  /** Departure time (HH:MM, station local time) at the queried station. */
  departure: string;
  /** Arrival time (HH:MM) at the requested destination, when the detail lists it. */
  arrival: string | null;
  /** Server rendered relative text, e.g. "En 3 minutos". Kept for diagnostics. */
  relativeText: string | null;
  originStation: string;
  destinationStation: string | null;
  stops: RawStop[];
}

export interface ScheduleResult {
  trains: RawTrain[];
  /** Service notices published with the timetable (works, suspensions...). */
  notices: string[];
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
  "&aacute;": "á",
  "&eacute;": "é",
  "&iacute;": "í",
  "&oacute;": "ó",
  "&uacute;": "ú",
  "&ntilde;": "ñ",
};

function decode(text: string): string {
  return text
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp|aacute|eacute|iacute|oacute|uacute|ntilde);/g, (m) => ENTITIES[m] ?? m);
}

function stripTags(html: string): string {
  return decode(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Loose comparison so "San Antonio de Padua" matches "S. A. de Padua". */
export function normalizeStationName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stationMatches(candidate: string, expected: string): boolean {
  const a = normalizeStationName(candidate);
  const b = normalizeStationName(expected);
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  // Compare token by token ignoring abbreviations like "s", "a", "de".
  const meaningful = (s: string) =>
    s.split(" ").filter((t) => t.length > 1 && !["de", "del", "la", "el"].includes(t));
  const ta = meaningful(a);
  const tb = meaningful(b);
  if (!ta.length || !tb.length) return false;
  // Every station on the line ends on a unique word ("…de Padua", "Ramos Mejía"),
  // so matching the last meaningful word covers abbreviations safely.
  return ta[ta.length - 1] === tb[tb.length - 1];
}

export interface ParseInput {
  html: string;
  /** Destination station name as the user knows it ("San Antonio de Padua"). */
  destination: string;
}

/**
 * Extracts the upcoming trains for a station/sense pair.
 * Throws when the markup no longer matches (so the caller can surface a real
 * error instead of silently inventing data).
 */
export function parseHorariosTrenes({ html, destination }: ParseInput): ScheduleResult {
  const notices: string[] = [];
  for (const match of html.matchAll(/<div class="alerta"[^>]*>([\s\S]*?)<\/div>/g)) {
    const text = stripTags(match[1])
      .replace(/^Anuncios para este ramal\s*/i, "")
      .trim();
    if (text) notices.push(text);
  }

  const nextStart = html.indexOf('class="nextTrains"');
  if (nextStart < 0) {
    throw new Error("HorariosTrenes: no se encontró la sección de próximos trenes (cambió el HTML).");
  }
  const passStart = html.indexOf('class="passTrains"', nextStart);
  const region = passStart > nextStart ? html.slice(nextStart, passStart) : html.slice(nextStart);

  const trains: RawTrain[] = [];
  const blocks = region.split(/<div class="horarioItem[^"]*">/).slice(1);

  for (const block of blocks) {
    const hora = /class="horarioItemHora">\s*(\d{1,2}:\d{2})\s*hs/.exec(block);
    if (!hora) continue;

    const texto = /class="horarioItemTexto">\s*([^<]*)/.exec(block);
    const stops: RawStop[] = [];
    for (const stop of block.matchAll(/<div class="detalleItem[^"]*">\s*(\d{1,2}:\d{2}):\s*([^<]*?)\s*<\/div>/g)) {
      const classes = /class="detalleItem([^"]*)"/.exec(stop[0])?.[1] ?? "";
      stops.push({
        time: stop[1],
        station: decode(stop[2]).trim(),
        isOrigin: /current/.test(classes),
      });
    }

    const originStop = stops.find((s) => s.isOrigin) ?? stops[0] ?? null;
    const destinationStop = stops.find((s) => !s.isOrigin && stationMatches(s.station, destination)) ?? null;

    trains.push({
      departure: hora[1],
      arrival: destinationStop?.time ?? null,
      relativeText: texto?.[1]?.trim() || null,
      originStation: originStop?.station ?? "",
      destinationStation: destinationStop?.station ?? null,
      stops,
    });
  }

  return { trains, notices };
}
