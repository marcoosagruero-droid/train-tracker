import type { ScheduleBundle, ScheduleQuery } from "../types";

/**
 * Contract every timetable source must satisfy.
 *
 * The rest of the app (favourites, geofencing, notifications, UI) only talks to
 * this interface, so swapping horariostrenes.com.ar for an official API, a GTFS
 * feed or real-time data later means writing one more implementation.
 */
export interface TrainDataProvider {
  readonly id: "live" | "demo";
  /** Shown in the source badge. */
  readonly label: string;
  getSchedule(query: ScheduleQuery): Promise<ScheduleBundle>;
}

/** Arguments sent to the Convex proxy action. */
export interface LiveFetchArgs {
  line: string;
  station: string;
  sentido: string;
  dia: string;
  destination: string;
}

export interface LiveTrainDto {
  departure: string;
  arrival: string | null;
  originStation: string;
  destinationStation: string | null;
}

export interface LiveScheduleDto {
  trains: LiveTrainDto[];
  notices: string[];
  fetchedAt: number;
  source: string;
  sourceUrl: string;
  dia: string;
}

/** Injected by React: the Convex action that proxies the external source. */
export type LiveFetchFn = (args: LiveFetchArgs) => Promise<LiveScheduleDto>;
