import { useMemo, useState } from "react";
import {
  Bell,
  BellOff,
  ChevronDown,
  Pencil,
  Star,
  Trash2,
  TrainFront,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { RouteView } from "@/hooks/use-trenes";
import { formatHhmm, formatRemaining } from "@/lib/trenes/time";
import { SourceBadge } from "./SourceBadge";

export function RouteCard({
  view,
  onEdit,
  onDelete,
  onToggleAlerts,
}: {
  view: RouteView;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAlerts: (enabled: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const next = view.nextTrain;
  const rest = useMemo(() => view.trains.slice(1), [view.trains]);

  return (
    <Card className="border-border/70 bg-card">
      <CardContent className="gap-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[var(--brand)]">
              <Star className="size-3.5 fill-current" />
              <span className="truncate text-base font-semibold tracking-tight">
                {view.originName} → {view.destinationName}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge
                variant="secondary"
                className="bg-[var(--brand-soft)] px-1.5 py-0 text-[11px] font-medium text-[var(--brand-strong)]"
              >
                {view.sentidoLabel}
              </Badge>
              <span className="text-xs text-muted-foreground">{view.lineLabel}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Switch
              checked={view.route.alerts}
              onCheckedChange={onToggleAlerts}
              aria-label={`Alertas de ${view.originName} → ${view.destinationName}`}
            />
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {view.route.alerts ? (
                <Bell className="size-4 text-[var(--ok)]" />
              ) : (
                <BellOff className="size-4 text-muted-foreground" />
              )}
            </span>
          </div>
        </div>

        {view.loading ? (
          <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-4 text-sm text-muted-foreground">
            <TrainFront className="size-4 animate-pulse" />
            Consultando horarios…
          </div>
        ) : view.error ? (
          <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-3 text-sm">
            <p className="font-medium text-[var(--danger)]">Información no disponible</p>
            <p className="mt-1 break-words text-xs text-muted-foreground">{view.error}</p>
          </div>
        ) : next ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="w-full rounded-lg bg-muted/60 p-3 text-left transition-colors hover:bg-muted"
          >
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Próximo tren
                </p>
                <p className="font-tabular text-3xl font-semibold leading-none">
                  {formatHhmm(next.departureMin)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Faltan
                </p>
                <p
                  className={cn(
                    "font-tabular text-2xl font-semibold leading-none",
                    next.minutesAway <= 5 ? "text-[var(--brand)]" : "text-foreground",
                  )}
                >
                  {formatRemaining(next.minutesAway)}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/70 pt-2 text-xs text-muted-foreground">
              <span>
                Llegada a {view.destinationName}:{" "}
                <span className="font-tabular text-foreground">
                  {next.arrivalMin !== null ? `${formatHhmm(next.arrivalMin)} hs` : "—"}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block size-1.5 rounded-full bg-muted-foreground/60" />
                {next.status.label}
              </span>
              <ChevronDown
                className={cn(
                  "ml-auto size-4 transition-transform",
                  expanded && "rotate-180",
                )}
              />
            </div>
          </button>
        ) : (
          <div className="rounded-lg bg-muted/60 px-3 py-4 text-sm">
            <p className="font-medium">Información no disponible</p>
            <p className="mt-1 text-xs text-muted-foreground">
              No se encontraron trenes próximos para este recorrido.
            </p>
          </div>
        )}

        {expanded && rest.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-lg border border-border/70">
            {rest.map((train, index) => (
              <div
                key={train.key}
                className={cn(
                  "flex items-center justify-between px-3 py-2 text-sm",
                  index > 0 && "border-t border-border/70",
                )}
              >
                <span className="font-tabular font-medium">{formatHhmm(train.departureMin)}</span>
                <span className="text-xs text-muted-foreground">
                  Llega {train.arrivalMin !== null ? formatHhmm(train.arrivalMin) : "—"}
                </span>
                <span className="font-tabular text-xs font-medium text-muted-foreground">
                  {formatRemaining(train.minutesAway)}
                </span>
              </div>
            ))}
          </div>
        )}

        {view.notices.length > 0 && (
          <p className="mt-3 rounded-lg border border-[var(--warn)]/30 bg-[var(--warn)]/10 px-3 py-2 text-xs leading-relaxed">
            {view.notices[0]}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <SourceBadge
            sourceLabel={view.sourceLabel}
            degradedReason={view.degradedReason}
          />
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs"
              onClick={onEdit}
            >
              <Pencil className="size-3.5" />
              Editar
            </Button>
            {confirmDelete ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={onDelete}
                >
                  Confirmar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancelar
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-[var(--danger)]"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-3.5" />
                Eliminar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
