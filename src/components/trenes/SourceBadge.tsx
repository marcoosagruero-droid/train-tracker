import { Info, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Data-source badge. Never lets demo numbers pass as published timetables:
 * anything that is not the live source is stamped "MODO DEMO".
 */
export function SourceBadge({
  sourceLabel,
  degradedReason,
  className,
}: {
  sourceLabel: string;
  degradedReason?: string;
  className?: string;
}) {
  const isDemo = sourceLabel !== "horariostrenes.com.ar";

  if (!sourceLabel || sourceLabel === "—") return null;

  const content = (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 border-none px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        isDemo
          ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]"
          : "bg-[var(--muted)] text-muted-foreground",
        className,
      )}
    >
      {isDemo ? <Info className="size-3" /> : <Radio className="size-3" />}
      {isDemo ? "MODO DEMO" : "Fuente real"}
    </Badge>
  );

  const detail = isDemo
    ? (degradedReason ??
      "Horarios de demostración. No son horarios publicados; activá la fuente real en Ajustes.")
    : "Horarios consultados a horariostrenes.com.ar a través del proxy propio.";

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs leading-relaxed">
        {detail}
      </TooltipContent>
    </Tooltip>
  );
}
