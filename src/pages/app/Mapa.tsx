import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { LocateFixed, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProximityMap } from "@/components/trenes/ProximityMap";
import { SourceBadge } from "@/components/trenes/SourceBadge";
import { captureSingleFix } from "@/lib/trenes/store";
import { updateSettings } from "@/lib/trenes/store";
import {
  formatDistance,
  getStation,
  haversineMeters,
  stationsByDistance,
} from "@/lib/trenes/stations";
import { RADIUS_OPTIONS } from "@/lib/trenes/settings";
import { formatHhmm, formatRemaining, nowArtMinutes } from "@/lib/trenes/time";
import { departureBoardTrain, useDepartureBoard, useRouteViews, useTicker, useTrenesState } from "@/hooks/use-trenes";
import { cn } from "@/lib/utils";

/** Section 16 — map with the user, nearby stations and the geofence radius. */
export default function Mapa() {
  const now = useTicker(30_000);
  const state = useTrenesState();
  const views = useRouteViews(now);
  const [highlightedId, setHighlightedId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const position = state.position;
  const watchedIds = useMemo(
    () =>
      state.favorites
        .filter((route) => route.alerts)
        .map((route) => route.originId)
        .filter((id, index, all) => all.indexOf(id) === index),
    [state.favorites],
  );

  const nearby = position
    ? stationsByDistance(position.lat, position.lng, 3)
    : [];
  const board = useDepartureBoard(
    highlightedId ? [highlightedId] : nearby.map((entry) => entry.station.id),
  );
  const nowMin = nowArtMinutes(now);

  const highlighted = highlightedId ? getStation(highlightedId) : null;
  const highlightedDistance =
    position && highlighted
      ? haversineMeters(position.lat, position.lng, highlighted.lat, highlighted.lng)
      : null;

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await captureSingleFix();
    } catch {
      /* surfaced by the status pill */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Mapa</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Esquema de la línea, tu posición y el radio de detección.
          </p>
        </div>
        <Button type="button" variant="outline" className="gap-2" onClick={handleRefresh} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
          Centrar en mí
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Radio
        </span>
        {RADIUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => updateSettings({ radiusM: option.value })}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              state.settings.radiusM === option.value
                ? "border-transparent bg-[var(--brand)] text-white"
                : "border-border/70 bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <ProximityMap
        position={position}
        watchedIds={watchedIds}
        radiusM={state.settings.radiusM}
        highlightedId={highlightedId}
        onStationSelect={(id) =>
          setHighlightedId((current) => (current === id ? undefined : id))
        }
      />

      {highlighted && (
        <motion.div
          key={highlighted.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border/70 bg-card p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-[var(--brand)]" />
              <h2 className="text-base font-semibold tracking-tight">{highlighted.name}</h2>
            </div>
            <span className="font-tabular text-sm font-semibold">
              {highlightedDistance !== null ? formatDistance(highlightedDistance) : "—"}
            </span>
          </div>

          <div className="mt-3 flex flex-col gap-2 border-t border-border/70 pt-3 text-sm">
            {(() => {
              const onceTrain = departureBoardTrain(
                board[`${highlighted.id}:Once`] ?? null,
                highlighted.id,
                "Once",
                nowMin,
              );
              const morenoTrain = departureBoardTrain(
                board[`${highlighted.id}:Moreno`] ?? null,
                highlighted.id,
                "Moreno",
                nowMin,
              );
              const related = views.filter((view) => view.route.originId === highlighted.id);
              if (related.length > 0) {
                return related.map((view) => (
                  <div key={view.route.id} className="flex items-center justify-between gap-3">
                    <span className="truncate">
                      {view.originName} → {view.destinationName}
                    </span>
                    <span className="font-tabular shrink-0 text-sm font-medium">
                      {view.nextTrain
                        ? `${formatHhmm(view.nextTrain.departureMin)} · ${formatRemaining(view.nextTrain.minutesAway)}`
                        : "Información no disponible"}
                    </span>
                  </div>
                ));
              }
              return (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Hacia Once</span>
                    <span className="font-tabular font-medium">
                      {onceTrain
                        ? `${formatHhmm(onceTrain.departureMin)} · ${formatRemaining(onceTrain.minutesAway)}`
                        : "Información no disponible"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Hacia Moreno</span>
                    <span className="font-tabular font-medium">
                      {morenoTrain
                        ? `${formatHhmm(morenoTrain.departureMin)} · ${formatRemaining(morenoTrain.minutesAway)}`
                        : "Información no disponible"}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </motion.div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {position
            ? `Posición ${position.source === "test" ? "simulada" : "por GPS"} · radio ${state.settings.radiusM} m`
            : "Sin ubicación: tocá «Centrar en mí» para habilitarla."}
        </p>
        <SourceBadge
          sourceLabel={
            views.find((view) => view.sourceLabel !== "—")?.sourceLabel ?? "MODO DEMO"
          }
        />
      </div>
    </div>
  );
}
