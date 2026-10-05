import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAlertStatus } from "@/hooks/use-trenes";
import {
  enableAlerts,
  refreshPermissions,
  requestNotifications,
} from "@/lib/trenes/store";
import type { AlertStatusTone } from "@/lib/trenes/permissions";

const TONE_CLASS: Record<AlertStatusTone, string> = {
  ok: "bg-[var(--ok)]",
  warn: "bg-[var(--warn)]",
  error: "bg-[var(--danger)]",
  idle: "bg-muted-foreground/50",
};

/**
 * Section 14 — location status. Tapping it explains the problem and offers the
 * exact fix (permission requests are always explicit, never silently skipped).
 */
export function AlertStatusPill() {
  const status = useAlertStatus();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleFix = async () => {
    setBusy(true);
    try {
      await enableAlerts();
      await requestNotifications();
      await refreshPermissions();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl border border-border/70 bg-card px-3.5 py-3 text-left transition-colors hover:bg-muted/60",
        )}
      >
        <span
          className={cn(
            "size-2.5 shrink-0 rounded-full",
            TONE_CLASS[status.tone],
            status.tone === "ok" && "animate-pulse",
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{status.label}</span>
          <span className="block truncate text-xs text-muted-foreground">
            Tocá para ver cómo solucionarlo
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="tracking-tight">
              {status.icon} {status.label}
            </DialogTitle>
            <DialogDescription className="whitespace-pre-line pt-1 text-sm leading-relaxed">
              {status.detail}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg bg-muted/70 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
            Tu ubicación se usa únicamente para detectar que estés cerca del origen de
            tus recorridos. No se envía a servidores ni se guarda historial de
            desplazamientos.
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void refreshPermissions();
                setOpen(false);
              }}
            >
              Revisar permisos
            </Button>
            {status.fixLabel && (
              <Button type="button" onClick={handleFix} disabled={busy}>
                {busy ? "Solicitando…" : status.fixLabel}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
