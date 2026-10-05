import { useState } from "react";
import { motion } from "framer-motion";
import { BellRing, LogOut, MapPin, Navigation, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StationSelect } from "@/components/trenes/StationSelect";
import { cn } from "@/lib/utils";
import {
  useRouteViews,
  useTicker,
  useTrenesState,
} from "@/hooks/use-trenes";
import {
  fixAtStation,
  fixFarAway,
  requestNotifications,
  runAlerts,
  simulatePosition,
} from "@/lib/trenes/store";
import { requireStation } from "@/lib/trenes/stations";
import { formatHhmm, formatRemaining, nowArtMinutes } from "@/lib/trenes/time";

const STATUS_LABEL: Record<string, string> = {
  notified: "Notificación enviada",
  "suppressed-cooldown": "Bloqueada por enfriamiento",
  "suppressed-rule": "No se cumplió la condición",
  "suppressed-duplicate": "Ya se avisó por ese tren",
  "no-route": "Sin recorridos en esa estación",
  "no-data": "Sin datos de horarios",
  error: "Error",
};

/** Section 17 — test mode: simulate location, geofence entry and notifications. */
export default function Prueba() {
  const now = useTicker(15_000);
  const state = useTrenesState();
  const views = useRouteViews(now);
  const [stationId, setStationId] = useState("merlo");
  const [busy, setBusy] = useState(false);

  const nowMin = nowArtMinutes(now);
  const station = requireStation(stationId);
  const related = views.filter((view) => view.route.originId === stationId);

  const handleEnter = () => {
    simulatePosition(fixAtStation(stationId));
    toast.success(`Ubicación simulada en ${station.name}.`, {
      description: `Radio de ${state.settings.radiusM} m: entrás a la zona de la estación.`,
    });
  };

  const handleExit = () => {
    simulatePosition(fixFarAway());
    toast.success("Ubicación simulada lejos de todas las estaciones (salida del geofence).");
  };

  const handleFire = async () => {
    setBusy(true);
    try {
      if (state.permissions.notification !== "granted") {
        await requestNotifications();
      }
      const outcomes = await runAlerts(stationId, "test");
      const notified = outcomes.find((entry) => entry.status === "notified");

      if (notified?.record) {
        toast.success(notified.record.title, { description: notified.record.body });
      } else {
        const first = outcomes[0];
        toast.info("No se generó la notificación.", {
          description: first?.detail ?? "Sin datos para evaluar.",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <header>
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Modo prueba</h1>
          <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-strong)]">
            Dev
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Simulá estar en una estación sin moverte: se ejecuta la misma cadena de
          detección que con el GPS real.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="test-station">
            Estación simulada
          </label>
          <StationSelect value={stationId} onValueChange={setStationId} />
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Button type="button" className="gap-2" onClick={handleEnter}>
            <Navigation className="size-4" />
            Entrar al geofence
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={handleExit}>
            <LogOut className="size-4" />
            Salir del geofence
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            onClick={handleFire}
            disabled={busy}
          >
            {busy ? (
              <Play className="size-4 animate-pulse" />
            ) : (
              <BellRing className="size-4" />
            )}
            Disparar alerta
          </Button>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-muted/70 px-3 py-2 text-xs text-muted-foreground">
          <span>
            Geofence:{" "}
            <strong className="text-foreground">{state.geo}</strong>
          </span>
          <span>
            Dentro de:{" "}
            <strong className="text-foreground">
              {state.inside.length ? state.inside.join(", ") : "ninguna"}
            </strong>
          </span>
          <span>
            Fuente:{" "}
            <strong className="text-foreground">
              {state.settings.dataSource === "demo" ? "demo" : "auto"}
            </strong>
          </span>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          «Disparar alerta» evalúa las reglas reales pero saltea el enfriamiento, para
          que puedas probar repetidamente.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Próximo tren en {station.name}
        </h2>
        {related.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No hay recorridos con origen en {station.name}. Creá uno desde
            «Mis recorridos» para ver la alerta completa.
          </p>
        ) : (
          related.map((view) => (
            <div
              key={view.route.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-3"
            >
              <span className="min-w-0 truncate text-sm font-medium">
                {view.originName} → {view.destinationName}
              </span>
              <span className="font-tabular shrink-0 text-sm">
                {view.nextTrain
                  ? `${formatHhmm(view.nextTrain.departureMin)} · ${formatRemaining(view.nextTrain.minutesAway)}`
                  : "Información no disponible"}
              </span>
            </div>
          ))
        )}
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Última evaluación
        </h2>
        {state.lastOutcomes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no se evaluó ninguna alerta.
          </p>
        ) : (
          state.lastOutcomes.map((outcome, index) => (
            <motion.div
              key={`${outcome.stationId}-${outcome.routeId ?? "none"}-${index}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border/70 bg-card px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="size-3.5 text-muted-foreground" />
                  {requireStationSafe(outcome.stationId)}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    outcome.status === "notified"
                      ? "bg-[var(--ok)]/15 text-[var(--ok)]"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {STATUS_LABEL[outcome.status] ?? outcome.status}
                </span>
              </div>
              <p className="mt-1.5 break-words text-xs text-muted-foreground">
                {outcome.detail}
              </p>
              {outcome.train && (
                <p className="font-tabular mt-1 text-xs">
                  Sale {formatHhmm(outcome.train.departureMin)} · faltan{" "}
                  {formatRemaining(outcome.train.minutesAway)}
                </p>
              )}
            </motion.div>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3 pb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Historial de alertas
        </h2>
        {state.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin alertas registradas.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
            {state.history.slice(0, 8).map((record, index) => (
              <div
                key={record.id}
                className={cn(
                  "px-4 py-2.5",
                  index > 0 && "border-t border-border/70",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm">{record.title}</span>
                  <span className="font-tabular shrink-0 text-xs text-muted-foreground">
                    {formatHhmm(nowArtMinutes(record.at))}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{record.body}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Hora actual (ART): <span className="font-tabular">{formatHhmm(nowMin)}</span>
      </p>
    </div>
  );
}

function requireStationSafe(id: string): string {
  try {
    return requireStation(id).name;
  } catch {
    return id;
  }
}
