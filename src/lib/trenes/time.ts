import type { DiaTipo } from "./types";

/**
 * Argentine trains run on America/Argentina/Buenos_Aires (UTC-3, no DST).
 * The timetable source renders absolute HH:MM times in that timezone, so every
 * calculation here is done against ART wall-clock minutes, regardless of the
 * device timezone. If the phone is set to another timezone the countdown still
 * matches the published timetable.
 */
export const ART_OFFSET_MIN = -180;
const DAY_MIN = 1440;

/** Minutes elapsed since ART midnight. */
export function nowArtMinutes(at: number = Date.now()): number {
  const art = new Date(at + ART_OFFSET_MIN * 60_000);
  return art.getUTCHours() * 60 + art.getUTCMinutes();
}

/** 0 = Sunday ... 6 = Saturday, in ART. */
export function nowArtWeekday(at: number = Date.now()): number {
  return new Date(at + ART_OFFSET_MIN * 60_000).getUTCDay();
}

/** Day type expected by the timetable source. */
export function diaForNow(at: number = Date.now()): DiaTipo {
  const day = nowArtWeekday(at);
  if (day === 0) return "domFer";
  if (day === 6) return "sab";
  return "habil";
}

export function parseHhmm(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Minutes from now until `targetMin`.
 * Timetables wrap around midnight, so a target slightly behind us still counts
 * as "the next day" only when it is more than half a day away.
 */
export function minutesUntil(targetMin: number, nowMin: number): number {
  let delta = targetMin - nowMin;
  if (delta < -DAY_MIN / 2) delta += DAY_MIN;
  return delta;
}

export function formatHhmm(minutes: number | null): string {
  if (minutes === null || Number.isNaN(minutes)) return "—";
  const normalized = ((minutes % DAY_MIN) + DAY_MIN) % DAY_MIN;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "7 min" · "1 h 05 min" · "ahora". */
export function formatRemaining(minutes: number | null): string {
  if (minutes === null || Number.isNaN(minutes)) return "—";
  if (minutes <= 0) return "ahora";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")} min`;
}

/** Plain Spanish phrase used inside notifications. */
export function spokenRemaining(minutes: number): string {
  if (minutes <= 0) return "sale en este momento";
  if (minutes === 1) return "sale en 1 minuto";
  if (minutes < 60) return `sale en ${minutes} minutos`;
  return `sale en ${formatRemaining(minutes)}`;
}

export function formatClock(at: number = Date.now()): string {
  return formatHhmm(nowArtMinutes(at));
}

export function formatRelativePast(timestamp: number): string {
  const diff = Math.max(0, Date.now() - timestamp);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return `hace ${h} h`;
}
