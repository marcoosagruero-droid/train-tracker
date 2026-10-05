/**
 * TrainDataProvider backend: own proxy for the external timetable source.
 *
 * The browser cannot call horariostrenes.com.ar directly (the site does not
 * send CORS headers), so every request goes through this Convex action. That
 * keeps the data layer swappable: the client only ever talks to
 * `api.trainData.getSchedule`, never to the third party site.
 *
 * Requests are deliberately polite: one GET per station/sense/day, cached on
 * the client for several minutes, no scraping of the disallowed paths listed
 * in the site's robots.txt.
 */
"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { parseHorariosTrenes, type RawTrain } from "../lib/trenes/parseHorariosTrenes";

const SOURCE_BASE = "https://www.horariostrenes.com.ar/horarios-tren-sarmiento";
const REQUEST_TIMEOUT_MS = 12_000;

export interface SchedulePayload {
  trains: RawTrain[];
  notices: string[];
  fetchedAt: number;
  source: "horariostrenes.com.ar";
  sourceUrl: string;
  /** Day type actually requested ("habil" | "sab" | "domFer"). */
  dia: string;
}

export const getSchedule = action({
  args: {
    line: v.string(),
    station: v.string(),
    sentido: v.string(),
    dia: v.string(),
    destination: v.string(),
  },
  handler: async (_ctx, args): Promise<SchedulePayload> => {
    if (args.line !== "sarmiento") {
      throw new Error(`Línea no soportada aún: ${args.line}`);
    }

    const sourceUrl =
      `${SOURCE_BASE}?estacion=${encodeURIComponent(args.station)}` +
      `&sentido=${encodeURIComponent(args.sentido)}&dia=${encodeURIComponent(args.dia)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(sourceUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Trenes/1.0 (proxy propio de consulta de horarios; contacto disponible en la app)",
          Accept: "text/html,application/xhtml+xml",
        },
      });

      if (!response.ok) {
        throw new Error(`La fuente respondió HTTP ${response.status}`);
      }

      const html = await response.text();
      const { trains, notices } = parseHorariosTrenes({
        html,
        destination: args.destination,
      });

      return {
        trains,
        notices,
        fetchedAt: Date.now(),
        source: "horariostrenes.com.ar",
        sourceUrl,
        dia: args.dia,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`No se pudo consultar la fuente de horarios: ${message}`);
    } finally {
      clearTimeout(timer);
    }
  },
});
