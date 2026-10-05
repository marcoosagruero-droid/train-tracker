import { requireStation } from "../stations";
import type { ScheduleBundle, ScheduleQuery } from "../types";
import type { LiveFetchFn, TrainDataProvider } from "./TrainDataProvider";

/**
 * Live provider backed by the Convex proxy action
 * (`trainData.getSchedule`). The browser never talks to the external site
 * directly, so CORS is a non-issue and the data layer stays replaceable.
 */
export function createLiveProvider(fetchSchedule: LiveFetchFn): TrainDataProvider {
  return {
    id: "live",
    label: "horariostrenes.com.ar",
    async getSchedule(query: ScheduleQuery): Promise<ScheduleBundle> {
      const origin = requireStation(query.originId);
      const destination = requireStation(query.destinationId);

      const dto = await fetchSchedule({
        line: origin.line,
        station: origin.sourceName,
        sentido: query.sentido,
        dia: query.dia,
        destination: destination.name,
      });

      return {
        source: "live",
        sourceLabel: "horariostrenes.com.ar",
        fetchedAt: dto.fetchedAt,
        notices: dto.notices,
        entries: dto.trains.map((train) => ({
          departure: train.departure,
          arrival: train.arrival,
          originStation: train.originStation,
          destinationStation: train.destinationStation,
        })),
      };
    },
  };
}
