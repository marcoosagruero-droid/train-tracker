import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Loader2, Star, TrainFront } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { StationSelect } from "@/components/trenes/StationSelect";
import { SourceBadge } from "@/components/trenes/SourceBadge";
import { cn } from "@/lib/utils";
import {
  computeUpcomingTrains,
} from "@/lib/trenes/nextTrain";
import {
  SARMIENTO_STATIONS,
  getStation,
  requireStation,
  travelMinutes,
} from "@/lib/trenes/stations";
import { addFavorite } from "@/lib/trenes/store";
import { formatHhmm, formatRemaining, nowArtMinutes, nowArtWeekday } from "@/lib/trenes/time";
import { useStationTimetable, useTicker } from "@/hooks/use-trenes";
import type { DiaTipo, Sentido } from "@/lib/trenes/types";

const DAY_OPTIONS: { value: DiaTipo | "auto"; label: string }[] = [
  { value: "auto", label: "Hoy" },
  { value: "habil", label: "Hábil" },
  { value: "sab", label: "Sábado" },
  { value: "domFer", label: "Dom./Feriado" },
];

const WEEKDAY_NAMES = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

const VISIBLE_ROWS = 12;

/** Per-station timetable: próximos trenes en ambos sentidos. */
export default function Horarios() {
  const now = useTicker(15_000);
  const [searchParams, setSearchParams] = useSearchParams();
  const [expanded, setExpanded] = useState(false);

  const requested = searchParams.get("estacion");
  const stationId =
    requested && SARMIENTO_STATIONS.some((s) => s.id === requested)
      ? requested
      : "merlo";

  const [sentido, setSentido] = useState<Sentido>("Once");
  const [dayOption, setDayOption] = useState<DiaTipo | "auto">("auto");

  const station = getStation(stationId);
  const terminalId = sentido === "Once" ? "once" : "moreno";
  const terminal = getStation(terminalId);
  const effectiveDia: DiaTipo = dayOption === "auto" ? autoDia(now) : dayOption;

  const { bundle, error, loading } = useStationTimetable(stationId, sentido, effectiveDia);

  const nowMin = nowArtMinutes(now);
  const trains =
    bundle && station && terminal
      ? computeUpcomingTrains({
          bundle,
          origin: station,
          destination: terminal,
          nowMin,
          limit: expanded ? 80 : VISIBLE_ROWS,
        })
      : [];

  const duration = station && terminal ? travelMinutes(station, terminal) : 0;

  const handleSelectStation = (id: string) => {
    setExpanded(false);
    const next = new URLSearchParams(searchParams);
    next.set("estacion", id);
    setSearchParams(next, { replace: true });
  };

  const handleSaveRoute = () => {
    if (!station || !terminal) return;
    const failure = addFavorite(station.id, terminal.id);
    if (failure) toast.error(failure);
    else
      toast.success(`Recorrido ${station.name} → ${terminal.name} guardado.`, {
        description: "Lo vas a encontrar en «Mis recorridos».",
      });
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Horarios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Próximos trenes de cualquier estación, en ambos sentidos.
        </p>
      </header>

      {/* Controls */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4">
        <div className="grid gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Estación
          </span>
          <StationSelect value={stationId} onValueChange={handleSelectStation} />
        </div>

        <div className="grid gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Sentido
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(["Once", "Moreno"] as Sentido[]).map((value) => (
              <Segment
                key={value}
                active={sentido === value}
                onClick={() => {
                  setSentido(value);
                  setExpanded(false);
                }}
              >
                {value === "Once" ? "→ Once" : "→ Moreno"}
              </Segment>
            ))}
          </div>
        </div>

        <div className="grid gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Día
          </span>
          <div className="grid grid-cols-4 gap-2">
            {DAY_OPTIONS.map((option) => (
              <Segment
                key={option.value}
                active={dayOption === option.value}
                onClick={() => {
                  setDayOption(option.value);
                  setExpanded(false);
                }}
              >
                {option.label}
              </Segment>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {dayOption === "auto"
              ? `Estás viendo el horario de hoy (${WEEKDAY_NAMES[nowArtWeekday(now)]}).`
              : "Horario fijo para ese tipo de día."}
          </p>
        </div>
      </div>

      {/* Summary */}
      {station && terminal && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {station.name} <span className="text-muted-foreground">hacia</span>{" "}
              {terminal.name}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Línea Sarmiento · {duration} min de viaje · {SARMIENTO_STATIONS.length}{" "}
              estaciones
            </p>
          </div>
          <SourceBadge
            sourceLabel={bundle?.sourceLabel ?? "—"}
            degradedReason={bundle?.degradedReason}
          />
        </div>
      )}

      {/* Notices */}
      {bundle && bundle.notices.length > 0 && (
        <p className="rounded-xl border border-[var(--warn)]/40 bg-[var(--warn)]/10 px-3.5 py-3 text-xs leading-relaxed">
          {bundle.notices[0]}
        </p>
      )}

      {/* Board */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-card px-4 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Consultando horarios…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-4 text-sm">
          <p className="font-medium text-[var(--danger)]">Información no disponible</p>
          <p className="mt-1 break-words text-xs text-muted-foreground">{error}</p>
        </div>
      ) : trains.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <TrainFront className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">Sin trenes para ese día</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Probá con otro día o con el otro sentido.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
          <div className="flex items-center justify-between border-b border-border/70 bg-muted/50 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <span>Salida</span>
            <span className="text-right">Llegada a {terminal?.name}</span>
          </div>

          {trains.map((train, index) => (
            <motion.div
              key={train.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.2) }}
              className={cn(
                "flex items-center justify-between gap-3 px-4 py-3",
                index > 0 && "border-t border-border/70",
                index === 0 && "bg-[var(--brand-soft)]/50",
              )}
            >
              <div className="flex min-w-0 items-baseline gap-3">
                <span className="font-tabular text-xl font-semibold">
                  {formatHhmm(train.departureMin)}
                </span>
                <span
                  className={cn(
                    "text-xs",
                    index === 0
                      ? "font-semibold text-[var(--brand-strong)]"
                      : "text-muted-foreground",
                  )}
                >
                  {index === 0
                    ? `en ${formatRemaining(train.minutesAway)}`
                    : formatRemaining(train.minutesAway)}
                </span>
              </div>

              <div className="shrink-0 text-right">
                <span className="font-tabular text-sm font-medium">
                  {train.arrivalMin !== null ? formatHhmm(train.arrivalMin) : "—"}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">{duration} min</span>
              </div>
            </motion.div>
          ))}

          {trains.length >= VISIBLE_ROWS && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="flex w-full items-center justify-center gap-1.5 border-t border-border/70 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              {expanded ? "Ver menos" : `Ver todos los trenes del día`}
              <ChevronDown className={cn("size-4", expanded && "rotate-180")} />
            </button>
          )}
        </div>
      )}

      {/* Save as favourite */}
      {station && terminal && (
        <Button type="button" className="gap-2" onClick={handleSaveRoute}>
          <Star className="size-4" />
          Guardar recorrido {station.name} → {terminal.name}
        </Button>
      )}

      <p className="pb-2 text-center text-xs text-muted-foreground">
        Hora actual (ART): <span className="font-tabular">{formatHhmm(nowMin)}</span>
        {requireStationSafe(stationId) && ` · estación ${requireStationSafe(stationId)}`}
      </p>
    </div>
  );
}

function autoDia(at: number): DiaTipo {
  const day = nowArtWeekday(at);
  if (day === 0) return "domFer";
  if (day === 6) return "sab";
  return "habil";
}

function Segment({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-[var(--brand)] text-white"
          : "border-border/70 bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function requireStationSafe(id: string): string {
  try {
    return requireStation(id).name;
  } catch {
    return "";
  }
}
