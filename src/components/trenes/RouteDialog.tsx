import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { addFavorite, updateFavorite } from "@/lib/trenes/store";
import { getStation, resolveDirection } from "@/lib/trenes/stations";
import type { FavoriteRoute } from "@/lib/trenes/types";
import { StationSelect } from "./StationSelect";

/**
 * Create / edit a favourite trip. The direction is never asked for: it is
 * derived from the two stations.
 */
export function RouteDialog({
  open,
  onOpenChange,
  route,
  presetOrigin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route?: FavoriteRoute | null;
  presetOrigin?: string;
}) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");

  useEffect(() => {
    if (!open) return;
    setOrigin(route?.originId ?? presetOrigin ?? "");
    setDestination(route?.destinationId ?? "");
  }, [open, route, presetOrigin]);

  const direction = useMemo(() => {
    if (!origin || !destination || origin === destination) return null;
    const originStation = getStation(origin);
    const destinationStation = getStation(destination);
    if (!originStation || !destinationStation) return null;
    return resolveDirection(originStation, destinationStation);
  }, [origin, destination]);

  const handleSave = () => {
    if (!origin || !destination) {
      toast.error("Elegí el origen y el destino del recorrido.");
      return;
    }
    if (origin === destination) {
      toast.error("El origen y el destino deben ser estaciones distintas.");
      return;
    }

    if (route) {
      updateFavorite(route.id, { originId: origin, destinationId: destination });
      toast.success("Recorrido actualizado.");
    } else {
      const error = addFavorite(origin, destination);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Recorrido guardado como favorito.", {
        description: `${getStation(origin)?.name ?? origin} → ${getStation(destination)?.name ?? destination}`,
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="tracking-tight">
            {route ? "Editar recorrido" : "Nuevo recorrido"}
          </DialogTitle>
          <DialogDescription>
            Guardá el recorrido una sola vez: la app determina la línea y el sentido
            automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="route-origin">Origen</Label>
            <StationSelect
              value={origin}
              onValueChange={setOrigin}
              placeholder="Estación de partida"
              exclude={destination}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="route-destination">Destino</Label>
            <StationSelect
              value={destination}
              onValueChange={setDestination}
              placeholder="Estación de llegada"
              exclude={origin}
            />
          </div>

          <div className="rounded-lg bg-muted/70 px-3 py-3 text-sm">
            {direction && !direction.invalid ? (
              <>
                <p className="font-medium">
                  {getStation(origin)?.name ?? origin} →{" "}
                  {getStation(destination)?.name ?? destination}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Línea Sarmiento · {direction.label} ·{" "}
                  {direction.sentido === "Once" ? "sale de Moreno" : "sale de Once"}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Elegí origen y destino para ver el sentido resuelto automáticamente.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave}>
            {route ? "Guardar cambios" : "Guardar favorito"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
