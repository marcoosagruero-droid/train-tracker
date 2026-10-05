import { loadJson, saveJson, STORAGE_KEYS } from "./storage";
import type {
  AlertRules,
  AlertSettings,
  RadiusM,
} from "./types";

/** SettingsManager: persisted alert configuration. */

export const DEFAULT_SETTINGS: AlertSettings = {
  alertsEnabled: false,
  radiusM: 500,
  dwellSeconds: 15,
  cooldownMin: 30,
  rules: {
    onEnter: true,
    within15: false,
    within10: false,
    within5: false,
  },
  dataSource: "auto",
  testMode: false,
};

export const RADIUS_OPTIONS: { value: RadiusM; label: string }[] = [
  { value: 200, label: "200 m" },
  { value: 500, label: "500 m" },
  { value: 1000, label: "1 km" },
];

export const DWELL_OPTIONS: { value: 0 | 15 | 30; label: string }[] = [
  { value: 0, label: "Al entrar" },
  { value: 15, label: "15 s dentro de la zona" },
  { value: 30, label: "30 s dentro de la zona" },
];

const VALID_RADII: number[] = [200, 500, 1000];
const VALID_DWELL: number[] = [0, 15, 30];

export function normalizeSettings(partial: Partial<AlertSettings>): AlertSettings {
  const merged: AlertSettings = { ...DEFAULT_SETTINGS, ...partial };
  return {
    ...merged,
    radiusM: (VALID_RADII.includes(merged.radiusM) ? merged.radiusM : 500) as RadiusM,
    dwellSeconds: (VALID_DWELL.includes(merged.dwellSeconds)
      ? merged.dwellSeconds
      : 15) as AlertSettings["dwellSeconds"],
    cooldownMin: Number.isFinite(merged.cooldownMin)
      ? Math.min(240, Math.max(0, merged.cooldownMin))
      : 30,
    rules: {
      ...DEFAULT_SETTINGS.rules,
      ...(merged.rules ?? {}),
    },
  };
}

export function loadSettings(): AlertSettings {
  return normalizeSettings(loadJson<AlertSettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS));
}

export function saveSettings(settings: AlertSettings): void {
  saveJson(STORAGE_KEYS.settings, settings);
}

export function defaultRules(): AlertRules {
  return { ...DEFAULT_SETTINGS.rules };
}

/**
 * Alert policy (combinable conditions).
 *
 * An alert fires when ANY enabled condition is true for the event:
 *  - "al entrar en la zona": fires on enter/dwell inside the geofence
 *  - "próximo tren en menos de X": fires while inside the zone whenever the
 *    countdown drops to X minutes or less (re-checked every few seconds)
 */
export function shouldAlert(options: {
  reason: "enter" | "dwell" | "tick" | "test";
  minutesAway: number;
  rules: AlertRules;
}): boolean {
  const { reason, minutesAway, rules } = options;
  if (reason === "test") return true;
  const entering = reason === "enter" || reason === "dwell";
  if (rules.onEnter && entering) return true;
  if (rules.within5 && minutesAway <= 5) return true;
  if (rules.within10 && minutesAway <= 10) return true;
  if (rules.within15 && minutesAway <= 15) return true;
  return false;
}

export function enabledThresholdMinutes(rules: AlertRules): number[] {
  const out: number[] = [];
  if (rules.within5) out.push(5);
  if (rules.within10) out.push(10);
  if (rules.within15) out.push(15);
  return out.sort((a, b) => a - b);
}
