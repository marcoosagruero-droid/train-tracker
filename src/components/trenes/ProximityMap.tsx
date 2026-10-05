import { useMemo } from "react";
import { SARMIENTO_STATIONS, haversineMeters } from "@/lib/trenes/stations";
import type { PositionFix } from "@/lib/trenes/types";
import { cn } from "@/lib/utils";

const M_PER_DEG = 111_320;
const PAD = 46;

/**
 * Offline schematic map (no tiles, no API key, works without connectivity).
 * Longitudes are scaled by cos(lat) so the geofence radius renders as a true
 * circle instead of an ellipse.
 */
export function ProximityMap({
  position,
  watchedIds = [],
  radiusM = 500,
  highlightedId,
  onStationSelect,
  className,
}: {
  position: PositionFix | null;
  watchedIds?: string[];
  radiusM?: number;
  highlightedId?: string;
  onStationSelect?: (stationId: string) => void;
  className?: string;
}) {
  const view = useMemo(() => {
    const latRef =
      SARMIENTO_STATIONS.reduce((sum, s) => sum + s.lat, 0) / SARMIENTO_STATIONS.length;
    const k = Math.cos((latRef * Math.PI) / 180);

    const xs = SARMIENTO_STATIONS.map((s) => s.lng * k);
    const ys = SARMIENTO_STATIONS.map((s) => -s.lat);
    if (position) {
      xs.push(position.lng * k);
      ys.push(-position.lat);
    }

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const widthUnits = Math.max(maxX - minX, 0.001);
    const heightUnits = Math.max(maxY - minY, 0.001);
    const viewBoxWidth = 760;
    const viewBoxHeight = 380;
    const scale = Math.min(
      (viewBoxWidth - PAD * 2) / widthUnits,
      (viewBoxHeight - PAD * 2) / heightUnits,
    );
    const offsetX = (viewBoxWidth - widthUnits * scale) / 2;
    const offsetY = (viewBoxHeight - heightUnits * scale) / 2;

    const project = (lat: number, lng: number) => ({
      x: offsetX + (lng * k - minX) * scale,
      y: offsetY + (-lat - minY) * scale,
    });

    return {
      project,
      scale,
      viewBox: `0 0 ${viewBoxWidth} ${viewBoxHeight}`,
      width: viewBoxWidth,
      height: viewBoxHeight,
    };
  }, [position]);

  const userPoint = position
    ? view.project(position.lat, position.lng)
    : null;

  const nearestIds = useMemo(() => {
    if (!position) return [];
    return SARMIENTO_STATIONS.map((station) => ({
      id: station.id,
      meters: haversineMeters(position.lat, position.lng, station.lat, station.lng),
    }))
      .sort((a, b) => a.meters - b.meters)
      .slice(0, 3)
      .map((entry) => entry.id);
  }, [position]);

  const radiusUnits = radiusM / M_PER_DEG;

  const watchedSet = new Set(watchedIds);
  const ordered = [...SARMIENTO_STATIONS].sort((a, b) => a.order - b.order);
  const path = ordered
    .map((station, index) => {
      const point = view.project(station.lat, station.lng);
      return `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/70 bg-[var(--muted)]",
        className,
      )}
    >
      <svg
        viewBox={view.viewBox}
        role="img"
        aria-label="Mapa esquemático de la línea Sarmiento con estaciones y posición del usuario"
        className="h-auto w-full"
      >
        <defs>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.45" />
          </linearGradient>
          <radialGradient id="userGlow">
            <stop offset="0%" stopColor="var(--info)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--info)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Geofence radius around watched origin stations */}
        {SARMIENTO_STATIONS.filter((station) => watchedSet.has(station.id)).map(
          (station) => {
            const point = view.project(station.lat, station.lng);
            return (
              <g key={`radius-${station.id}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={Math.max(6, radiusUnits * view.scale)}
                  fill="var(--brand)"
                  fillOpacity="0.12"
                  stroke="var(--brand)"
                  strokeOpacity="0.55"
                  strokeDasharray="4 4"
                />
                <circle cx={point.x} cy={point.y} r={Math.max(6, radiusUnits * view.scale)} fill="none">
                  <animate
                    attributeName="r"
                    values={`${Math.max(6, radiusUnits * view.scale)};${Math.max(10, radiusUnits * view.scale * 1.06)};${Math.max(6, radiusUnits * view.scale)}`}
                    dur="4s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="stroke-opacity"
                    values="0.55;0.15;0.55"
                    dur="4s"
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            );
          },
        )}

        <path
          d={path}
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* User position */}
        {userPoint && (
          <g>
            <circle cx={userPoint.x} cy={userPoint.y} r="46" fill="url(#userGlow)" />
            <circle
              cx={userPoint.x}
              cy={userPoint.y}
              r="7"
              fill="var(--info)"
              stroke="var(--card)"
              strokeWidth="2.5"
            />
            <title>Tu ubicación (±{Math.round(position?.accuracy ?? 0)} m)</title>
          </g>
        )}

        {SARMIENTO_STATIONS.map((station) => {
          const point = view.project(station.lat, station.lng);
          const watched = watchedSet.has(station.id);
          const highlighted = highlightedId === station.id;
          const showLabel =
            watched || highlighted || nearestIds.includes(station.id) || station.order === 0 || station.order === 15;

          return (
            <g
              key={station.id}
              onClick={onStationSelect ? () => onStationSelect(station.id) : undefined}
              className={onStationSelect ? "cursor-pointer" : undefined}
            >
              <title>{station.name}</title>
              <circle
                cx={point.x}
                cy={point.y}
                r={watched || highlighted ? 7 : 4.5}
                fill={watched || highlighted ? "var(--brand)" : "var(--card)"}
                stroke={watched || highlighted ? "var(--brand-strong)" : "var(--muted-foreground)"}
                strokeWidth="2"
              />
              {showLabel && (
                <text
                  x={point.x}
                  y={point.y - 13}
                  textAnchor="middle"
                  className="fill-foreground"
                  fontSize="11"
                  fontWeight="600"
                >
                  {station.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/70 bg-card px-3 py-2 text-[11px] text-muted-foreground">
        <Legend color="var(--info)" label="Tu ubicación" />
        <Legend color="var(--brand)" label={`Origen vigilado (${radiusM} m)`} />
        <Legend color="var(--muted-foreground)" label="Estación" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block size-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
