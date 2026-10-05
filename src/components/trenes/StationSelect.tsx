import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SARMIENTO_STATIONS } from "@/lib/trenes/stations";

export function StationSelect({
  value,
  onValueChange,
  placeholder = "Elegí una estación",
  exclude,
  disabled,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  exclude?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="w-full cursor-pointer">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {SARMIENTO_STATIONS.filter((station) => station.id !== exclude).map(
          (station) => (
            <SelectItem key={station.id} value={station.id} className="cursor-pointer">
              {station.name}
            </SelectItem>
          ),
        )}
      </SelectContent>
    </Select>
  );
}
