/**
 * Verificación repetible de la lógica del MVP.
 *
 *   bun run scripts/verify.ts
 *
 * 1) baja la página real de horarios y la parsea
 * 2) comprueba la resolución de sentido (origen + destino → sentido)
 * 3) valida el horario demo y la calculadora de próximo tren
 * 4) valida las reglas de alerta combinables
 */
import { parseHorariosTrenes } from "../src/lib/trenes/parseHorariosTrenes";
import { resolveDirection, requireStation, travelMinutes } from "../src/lib/trenes/stations";
import { computeUpcomingTrains } from "../src/lib/trenes/nextTrain";
import { demoProvider } from "../src/lib/trenes/providers/demo";
import { createLiveProvider } from "../src/lib/trenes/providers/live";
import { shouldAlert } from "../src/lib/trenes/settings";
import { buildNotification } from "../src/lib/trenes/alerts";
import { diaForNow, formatHhmm, nowArtMinutes } from "../src/lib/trenes/time";

let failures = 0;
function check(label: string, condition: boolean, extra?: unknown) {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}`, extra ?? "");
  }
}

const PAGE =
  "https://www.horariostrenes.com.ar/horarios-tren-sarmiento?estacion=Merlo&sentido=Once&dia=habil";

console.log("1) Parser contra la fuente real");
const response = await fetch(PAGE, {
  headers: { "User-Agent": "Trenes/1.0 (verificación local)" },
});
check("HTTP 200", response.ok, response.status);
const html = await response.text();

const parsed = parseHorariosTrenes({ html, destination: "Liniers" });
check("extrae avisos de servicio", Array.isArray(parsed.notices));
check("parsea trenes próximos", parsed.trains.length > 0, parsed.trains.length);
const first = parsed.trains[0];
check("salida en HH:MM", /^\d{1,2}:\d{2}$/.test(first.departure), first.departure);
check("llegada a Liniers resuelta", first.arrival !== null, first.arrival);
check("estación de origen identificada", first.originStation.length > 0, first.originStation);
console.log(`       ejemplo: sale ${first.departure} → Liniers ${first.arrival}`);

const padua = parseHorariosTrenes({ html, destination: "San Antonio de Padua" });
check(
  "abreviatura «S. A. de Padua» reconocida",
  padua.trains.some((t) => t.arrival !== null),
  padua.trains.slice(0, 3).map((t) => t.arrival),
);

console.log("2) origen + destino → sentido");
const merlo = requireStation("merlo");
const liniers = requireStation("liniers");
check("Merlo → Liniers = hacia Once", resolveDirection(merlo, liniers).sentido === "Once");
check("Liniers → Merlo = hacia Moreno", resolveDirection(liniers, merlo).sentido === "Moreno");
check(
  "origen = destino es inválido",
  resolveDirection(merlo, merlo).invalid === true,
);
const merloOnce = travelMinutes(merlo, requireStation("once"));
check(
  "Merlo → Once tiene duración plausible",
  merloOnce > 20 && merloOnce < 60,
  merloOnce,
);

console.log("3) TrainDataProvider");
const live = createLiveProvider(async (args) => {
  const url =
    `https://www.horariostrenes.com.ar/horarios-tren-sarmiento` +
    `?estacion=${encodeURIComponent(args.station)}&sentido=${encodeURIComponent(args.sentido)}` +
    `&dia=${encodeURIComponent(args.dia)}`;
  const res = await fetch(url, { headers: { "User-Agent": "Trenes/1.0 (verificación local)" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  const result = parseHorariosTrenes({ html: body, destination: args.destination });
  return {
    trains: result.trains.map((train) => ({
      departure: train.departure,
      arrival: train.arrival,
      originStation: train.originStation,
      destinationStation: train.destinationStation,
    })),
    notices: result.notices,
    fetchedAt: Date.now(),
    source: "horariostrenes.com.ar",
    sourceUrl: url,
    dia: args.dia,
  };
});

const liveBundle = await live.getSchedule({
  originId: "merlo",
  destinationId: "liniers",
  sentido: "Once",
  dia: diaForNow(),
});
check("proveedor live etiqueta la fuente", liveBundle.sourceLabel === "horariostrenes.com.ar");
check("proveedor live devuelve llegadas", liveBundle.entries.some((e) => e.arrival !== null));

const demoBundle = await demoProvider.getSchedule({
  originId: "merlo",
  destinationId: "liniers",
  sentido: "Once",
  dia: "habil",
});
check("proveedor demo etiqueta MODO DEMO", demoBundle.sourceLabel === "MODO DEMO");
check("proveedor demo genera servicio abundante", demoBundle.entries.length > 40, demoBundle.entries.length);

const toMin = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};
check(
  "la llegada del demo respeta el tiempo de viaje",
  demoBundle.entries.every((entry) => {
    let delta = toMin(entry.arrival ?? "00:00") - toMin(entry.departure);
    if (delta < -720) delta += 1440; // cruce de medianoche
    return delta === travelMinutes(merlo, liniers);
  }),
);

const nowMin = nowArtMinutes();
const trains = computeUpcomingTrains({
  bundle: demoBundle,
  origin: merlo,
  destination: liniers,
  nowMin,
  limit: 3,
});
check("próximos trenes ordenados y futuros", trains.every((t) => t.minutesAway >= 0));
if (trains[0]) {
  console.log(
    `       próximo demo: ${formatHhmm(trains[0].departureMin)} en ${trains[0].minutesAway} min`,
  );
  const notification = buildNotification(trains[0]);
  check("la notificación nombra origen y destino", notification.body.includes("Merlo → Liniers"), notification.body);
  check("la notificación incluye la cuenta regresiva", /sale en \d+ minutos/.test(notification.body), notification.body);
}

console.log("4) reglas de alerta combinables");
const off = { onEnter: false, within15: false, within10: false, within5: false };
check("«al entrar» dispara de inmediato", shouldAlert({ reason: "enter", minutesAway: 40, rules: { ...off, onEnter: true } }));
check("sin condiciones no dispara", !shouldAlert({ reason: "enter", minutesAway: 40, rules: off }));
check("umbral de 10 dispara a 9 min", shouldAlert({ reason: "tick", minutesAway: 9, rules: { ...off, within10: true } }));
check("umbral de 10 no dispara a 11 min", !shouldAlert({ reason: "tick", minutesAway: 11, rules: { ...off, within10: true } }));
check("umbral de 5 no dispara a 8 min", !shouldAlert({ reason: "tick", minutesAway: 8, rules: { ...off, within5: true } }));
check("el modo prueba siempre dispara", shouldAlert({ reason: "test", minutesAway: 90, rules: off }));

if (failures > 0) {
  console.error(`\n${failures} verificación(es) fallaron`);
  process.exit(1);
}
console.log("\nTodas las verificaciones pasaron ✅");
