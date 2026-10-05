import { requireStation, travelMinutes } from "../stations";
import type { ScheduleBundle, ScheduleEntry, ScheduleQuery } from "../types";
import { entryFromMinutes } from "../nextTrain";
import { minutesUntil, nowArtMinutes } from "../time";
import type { TrainDataProvider } from "./TrainDataProvider";

/**
 * MODO DEMO.
 *
 * A deterministic approximation of the Sarmiento timetable used only when the
 * real source is unavailable or the user explicitly selects demo data. Every
 * bundle produced here is labelled "MODO DEMO" so it can never be mistaken for
 * published times.
 */

interface Window {
  from: number;
  to: number;
  headway: (at: number) => number;
}

const WINDOWS: Record<ScheduleQuery["dia"], Window> = {
  habil: {
    from: 270, // 04:30
    to: 1410, // 23:30
    headway: (at) =>
      at < 360 ? 20 : at < 570 ? 7 : at < 960 ? 12 : at < 1170 ? 7 : at < 1320 ? 12 : 20,
  },
  sab: {
    from: 300, // 05:00
    to: 1380, // 23:00
    headway: (at) => (at < 480 ? 15 : at < 1200 ? 12 : 20),
  },
  domFer: {
    from: 360, // 06:00
    to: 1380, // 23:00
    headway: (at) => (at < 540 ? 20 : at < 1200 ? 15 : 25),
  },
};

function terminalDepartures(dia: ScheduleQuery["dia"]): number[] {
  const window = WINDOWS[dia];
  const out: number[] = [];
  let at = window.from;
  while (at <= window.to) {
    out.push(at);
    at += window.headway(at);
  }
  return out;
}

/** Full-day list of departures for one trip, in terminal-relative time. */
export function buildDemoEntries(query: ScheduleQuery): ScheduleEntry[] {
  const origin = requireStation(query.originId);
  const destination = requireStation(query.destinationId);
  // sentido = terminal the train is heading to, so it STARTS at the other one:
  // "hacia Once" services depart from Moreno, "hacia Moreno" depart from Once.
  const departureTerminal =
    query.sentido === "Once" ? requireStation("moreno") : requireStation("once");

  const toOrigin = travelMinutes(departureTerminal, origin);
  const toDestination = travelMinutes(departureTerminal, destination);
  const nowMin = nowArtMinutes();

  return terminalDepartures(query.dia)
    .map((terminalDeparture) =>
      entryFromMinutes(
        terminalDeparture + toOrigin,
        terminalDeparture + toDestination,
        origin.name,
        destination.name,
      ),
    )
    .filter((entry) => {
      const departure = toMinutes(entry.departure);
      const away = minutesUntil(departure, nowMin);
      // Keep the useful window: what is running now plus the next hours.
      return away >= -10 && away <= 750;
    });
}

function toMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export const demoProvider: TrainDataProvider = {
  id: "demo",
  label: "MODO DEMO",
  async getSchedule(query) {
    const bundle: ScheduleBundle = {
      source: "demo",
      sourceLabel: "MODO DEMO",
      fetchedAt: Date.now(),
      notices: [
        "Horarios de demostración: no son horarios publicados. Activá la fuente real en Ajustes.",
      ],
      entries: buildDemoEntries(query),
    };
    return bundle;
  },
};
