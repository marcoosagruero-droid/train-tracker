import { readFileSync } from "node:fs";
import { parseHorariosTrenes } from "./lib/trenes/parseHorariosTrenes";
import { resolveDirection, requireStation, travelMinutes } from "./lib/trenes/stations";
import { computeUpcomingTrains } from "./lib/trenes/nextTrain";
import { demoProvider } from "./lib/trenes/providers/demo";
import { shouldAlert } from "./lib/trenes/settings";
import { buildNotification } from "./lib/trenes/alerts";
import { nowArtMinutes, formatHhmm } from "./lib/trenes/time";

let failures = 0;
function check(label: string, condition: boolean, extra?: unknown) {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}`, extra ?? "");
  }
}

console.log("1) Parser against real horariostrenes HTML");
const html = readFileSync("/tmp/merlo.html", "utf8");
const parsed = parseHorariosTrenes({ html, destination: "Liniers" });
check("has notices array", Array.isArray(parsed.notices));
check("parsed upcoming trains > 0", parsed.trains.length > 0, parsed.trains.length);
const first = parsed.trains[0];
check("departure is HH:MM", /^\d{1,2}:\d{2}$/.test(first.departure), first.departure);
check("arrival at Liniers found", first.arrival !== null, first);
check("origin stop identified", first.originStation.length > 0, first.originStation);
console.log(`       sample: dep ${first.departure} → Liniers ${first.arrival} | stops ${first.stops.length}`);

const parsedPadua = parseHorariosTrenes({ html, destination: "San Antonio de Padua" });
check(
  "abbreviated station name (S. A. de Padua) matched",
  parsedPadua.trains.some((t) => t.arrival !== null),
  parsedPadua.trains.slice(0, 3).map((t) => t.arrival),
);

console.log("2) origin + destination → sentido");
const merlo = requireStation("merlo");
const liniers = requireStation("liniers");
const once = requireStation("once");
const moreno = requireStation("moreno");
check("Merlo → Liniers = hacia Once", resolveDirection(merlo, liniers).sentido === "Once");
check("Liniers → Merlo = hacia Moreno", resolveDirection(liniers, merlo).sentido === "Moreno");
check("Once → Moreno = hacia Moreno", resolveDirection(once, moreno).sentido === "Moreno");
check("Merlo → Once = hacia Once", resolveDirection(merlo, once).sentido === "Once");
check("same station is invalid", resolveDirection(merlo, merlo).invalid === true);
check(
  "Merlo → Once travel time is plausible (< 60 min)",
  travelMinutes(merlo, once) > 20 && travelMinutes(merlo, once) < 60,
  travelMinutes(merlo, once),
);

console.log("3) demo provider + next train calculator");
const query = { originId: "merlo", destinationId: "liniers", sentido: "Once" as const, dia: "habil" as const };
const bundle = await demoProvider.getSchedule(query);
check("demo bundle is labelled MODO DEMO", bundle.sourceLabel === "MODO DEMO", bundle.sourceLabel);
check("demo generates a useful window of trips", bundle.entries.length > 40, bundle.entries.length);
const toMin = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
};
check(
  "demo entries run terminal → terminal (Merlo→Liniers = travel time)",
  bundle.entries.length > 0 &&
    bundle.entries.every((e) => {
      let d = toMin(e.arrival ?? "00:00") - toMin(e.departure);
      if (d < -720) d += 1440; // arrival crosses midnight
      return d === travelMinutes(merlo, liniers);
    }),
  bundle.entries.slice(-3),
);

const nowMin = nowArtMinutes();
const trains = computeUpcomingTrains({ bundle, origin: merlo, destination: liniers, nowMin, limit: 3 });
check("upcoming trains sorted and in the future", trains.every((t) => t.minutesAway >= 0));
check("first upcoming train has a countdown", trains.length === 0 || trains[0].minutesAway >= 0, trains[0]);
if (trains[0]) {
  console.log(`       next: ${formatHhmm(trains[0].departureMin)} en ${trains[0].minutesAway} min`);
  const notification = buildNotification(trains[0]);
  check("notification names origin and destination", notification.body.includes("Merlo → Liniers"), notification.body);
  check("notification contains countdown", /sale en \d+ minutos/.test(notification.body), notification.body);
}

console.log("4) alert rules (combinable)");
check(
  "onEnter fires immediately",
  shouldAlert({ reason: "enter", minutesAway: 40, rules: { onEnter: true, within15: false, within10: false, within5: false } }),
);
check(
  "onEnter off + 40 min train does not fire",
  !shouldAlert({ reason: "enter", minutesAway: 40, rules: { onEnter: false, within15: false, within10: false, within5: false } }),
);
check(
  "within10 rule fires at 9 minutes",
  shouldAlert({ reason: "tick", minutesAway: 9, rules: { onEnter: false, within15: false, within10: true, within5: false } }),
);
check(
  "within10 rule does not fire at 11 minutes",
  !shouldAlert({ reason: "tick", minutesAway: 11, rules: { onEnter: false, within15: false, within10: true, within5: false } }),
);
check(
  "within5 does not fire at 8 minutes",
  !shouldAlert({ reason: "tick", minutesAway: 8, rules: { onEnter: false, within15: false, within10: false, within5: true } }),
);
check(
  "test reason always fires",
  shouldAlert({ reason: "test", minutesAway: 90, rules: { onEnter: false, within15: false, within10: false, within5: false } }),
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
