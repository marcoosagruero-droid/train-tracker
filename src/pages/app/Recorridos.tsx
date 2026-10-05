import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Star, TrainFront } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertStatusPill } from "@/components/trenes/AlertStatusPill";
import { RouteCard } from "@/components/trenes/RouteCard";
import { RouteDialog } from "@/components/trenes/RouteDialog";
import { SourceBadge } from "@/components/trenes/SourceBadge";
import { invalidateScheduleCache } from "@/lib/trenes/providers";
import {
  deleteFavorite,
  updateFavorite,
} from "@/lib/trenes/store";
import type { FavoriteRoute } from "@/lib/trenes/types";
import { useRouteViews, useTicker, useTrenesState } from "@/hooks/use-trenes";

/** Section 13 — the main screen: "Mis recorridos". */
export default function Recorridos() {
  const now = useTicker(30_000);
  const state = useTrenesState();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FavoriteRoute | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const views = useRouteViews(now, refreshToken);

  const activeAlerts = views.filter((view) => view.route.alerts).length;
  const degraded = views.find((view) => view.degradedReason);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="lg:hidden">
        <AlertStatusPill />
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Mis recorridos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {views.length === 0
              ? "Guardá tu primer recorrido para recibir alertas."
              : `${views.length} guardado${views.length === 1 ? "" : "s"} · ${activeAlerts} con alertas activas`}
          </p>
        </div>
        <Button
          type="button"
          className="gap-2"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          Nuevo recorrido
        </Button>
      </header>

      {degraded && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--warn)]/40 bg-[var(--warn)]/10 px-3.5 py-3 text-sm">
          <span className="font-medium text-[var(--brand-strong)]">MODO DEMO</span>
          <span className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
            {degraded.degradedReason} Los horarios que ves no son publicados.
          </span>
        </div>
      )}

      {views.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--brand-strong)]">
            <TrainFront className="size-6" />
          </span>
          <div>
            <p className="font-medium">Todavía no tenés recorridos</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Guardá por ejemplo <span className="font-medium">Merlo → Liniers</span> y la
              app va a determinar sola la línea, el sentido y la estación a vigilar.
            </p>
          </div>
          <Button
            type="button"
            className="mt-1 gap-2"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Star className="size-4" />
            Crear recorrido
          </Button>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-3">
          {views.map((view, index) => (
            <motion.div
              key={view.route.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(index * 0.05, 0.3) }}
            >
              <RouteCard
                view={view}
                onEdit={() => {
                  setEditing(view.route);
                  setDialogOpen(true);
                }}
                onDelete={() => deleteFavorite(view.route.id)}
                onToggleAlerts={(enabled) =>
                  updateFavorite(view.route.id, { alerts: enabled })
                }
              />
            </motion.div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <SourceBadge
          sourceLabel={
            degraded || state.settings.dataSource === "demo" ? "MODO DEMO" : "horariostrenes.com.ar"
          }
          degradedReason={degraded?.degradedReason}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={() => {
            invalidateScheduleCache();
            setRefreshToken((value) => value + 1);
            toast.success("Horarios actualizados.");
          }}
        >
          Actualizar horarios
        </Button>
      </div>

      <RouteDialog
        key={`${editing?.id ?? "nuevo"}-${dialogOpen ? "abierto" : "cerrado"}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        route={editing}
      />
    </div>
  );
}
