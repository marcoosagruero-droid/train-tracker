import { useState } from "react";
import { motion } from "framer-motion";
import { Crosshair, Loader2, LocateFixed, MapPin, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertStatusPill } from "@/components/trenes/AlertStatusPill";
import { SourceBadge } from "@/components/trenes/SourceBadge";
import {
  departureBoardTrain,
  useDepartureBoard,
  useRouteViews,
  useTicker,
  useTrenesState,
} from "@/hooks/use-trenes";
import { addFavorite, captureSingleFix } from "@/lib/trenes/store";
import {
  formatDistance,
  stationsByDistance,
} from "@/lib/trenes/stations";
import { formatHhmm, formatRemaining, nowArtMinutes } from "@/lib/trenes/time";

/** Section 15 — "📍 Cerca de mí": nearby stations + distance diagnostics. */
export default function CercaDeMi() {
  const now = useTicker(20_000);
  const state = useTrenesState();
  const views = useRouteViews(now);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const position = state.position;
  const nearby = position
    ? stationsByDistance(position.lat, position.lng, 5)
    : [];
  const board = useDepartureBoard(
    nearby.map((entry) => entry.station.id),
  );
  const nowMin = nowArtMinutes(now);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      await captureSingleFix();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo obtener la ubicación.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="lg:hidden">
        <AlertStatusPill />
      </div>

      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Cerca de mí
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estaciones cercanas, distancia aproximada y próximo tren de cada una.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-3.5">
        <div className="min-w-0">
          {position ? (
            <>
              <p className="text-sm font-medium">
                Ubicación actual · ±{Math.round(position.accuracy)} m
              </p>
              <p className="font-tabular mt-0.5 text-xs text-muted-foreground">
                {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
                {position.source === "test" ? " · simulada" : ""}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Sin ubicación todavía</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Pedí tu ubicación para ver las estaciones más cercanas.
              </p>
            </>
          )}
        </div>
        <Button type="button" className="gap-2" onClick={handleRefresh} disabled={loading}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LocateFixed className="size-4" />
          )}
          {position ? "Actualizar" : "Mi ubicación"}
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3.5 py-3 text-sm">
          <p className="font-medium text-[var(--danger)]">No se pudo obtener la ubicación</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        </div>
      )}

      {!position ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--brand-strong)]">
            <Crosshair className="size-6" />
          </span>
          <p className="max-w-sm text-sm text-muted-foreground">
            Esta pantalla también sirve para comprobar que el GPS funciona: cuando
            tengas ubicación verás la distancia a cada estación.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {nearby.map((entry, index) => {
            const station = entry.station;
            const related = views.filter(
              (view) => view.route.originId === station.id,
            );
            const inside = state.inside.includes(station.id);
            const onceTrain = departureBoardTrain(
              board[`${station.id}:Once`] ?? null,
              station.id,
              "Once",
              nowMin,
            );
            const morenoTrain = departureBoardTrain(
              board[`${station.id}:Moreno`] ?? null,
              station.id,
              "Moreno",
              nowMin,
            );

            return (
              <motion.div
                key={station.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: Math.min(index * 0.05, 0.25) }}
                className="rounded-xl border border-border/70 bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <MapPin
                        className={`size-4 ${inside ? "text-[var(--brand)]" : "text-muted-foreground"}`}
                      />
                      <h2 className="truncate text-base font-semibold tracking-tight">
                        {station.name}
                      </h2>
                      {inside && (
                        <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--brand-strong)]">
                          Dentro de la zona
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">Línea Sarmiento</p>
                  </div>
                  <span className="font-tabular shrink-0 text-lg font-semibold">
                    {formatDistance(entry.meters)}
                  </span>
                </div>

                {related.length > 0 ? (
                  <div className="mt-3 flex flex-col gap-2 border-t border-border/70 pt-3">
                    {related.map((view) => (
                      <div
                        key={view.route.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="min-w-0 truncate text-sm">
                          <Star className="mr-1 inline size-3 fill-current text-[var(--brand)]" />
                          {view.originName} → {view.destinationName}
                        </span>
                        <span className="shrink-0 text-right">
                          {view.nextTrain ? (
                            <>
                              <span className="font-tabular text-sm font-semibold">
                                {formatHhmm(view.nextTrain.departureMin)}
                              </span>{" "}
                              <span className="text-xs text-muted-foreground">
                                faltan {formatRemaining(view.nextTrain.minutesAway)}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Información no disponible
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col gap-2 border-t border-border/70 pt-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">Próximo hacia Once</span>
                      <span className="font-tabular text-sm font-medium">
                        {onceTrain
                          ? `${formatHhmm(onceTrain.departureMin)} · ${formatRemaining(onceTrain.minutesAway)}`
                          : "Información no disponible"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">Próximo hacia Moreno</span>
                      <span className="font-tabular text-sm font-medium">
                        {morenoTrain
                          ? `${formatHhmm(morenoTrain.departureMin)} · ${formatRemaining(morenoTrain.minutesAway)}`
                          : "Información no disponible"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => {
                          const error = addFavorite(station.id, "once");
                          if (error) toast.error(error);
                          else
                            toast.success(
                              `Recorrido ${station.name} → Once guardado.`,
                            );
                        }}
                      >
                        <Star className="size-3.5" />
                        Guardar desde aquí
                      </Button>
                      <SourceBadge
                        sourceLabel={board[`${station.id}:Once`]?.sourceLabel ?? "—"}
                        degradedReason={board[`${station.id}:Once`]?.degradedReason}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
