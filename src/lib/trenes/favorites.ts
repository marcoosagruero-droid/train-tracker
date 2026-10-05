import { getStation, requireStation, resolveDirection } from "./stations";
import type { FavoriteRoute } from "./types";

/** FavoritesManager: pure functions over the favourite-route list. */

export function routeKey(originId: string, destinationId: string): string {
  return `${originId}->${destinationId}`;
}

export function findRoute(
  routes: FavoriteRoute[],
  originId: string,
  destinationId: string,
): FavoriteRoute | undefined {
  return routes.find((r) => routeKey(r.originId, r.destinationId) === routeKey(originId, destinationId));
}

export function createRoute(originId: string, destinationId: string): FavoriteRoute {
  return {
    id: `${routeKey(originId, destinationId)}#${Date.now().toString(36)}`,
    originId,
    destinationId,
    createdAt: Date.now(),
    alerts: true,
  };
}

export function upsertRoute(
  routes: FavoriteRoute[],
  originId: string,
  destinationId: string,
): { routes: FavoriteRoute[]; created: FavoriteRoute | null; reason?: string } {
  if (originId === destinationId) {
    return { routes, created: null, reason: "El origen y el destino deben ser distintos." };
  }
  const existing = findRoute(routes, originId, destinationId);
  if (existing) {
    return { routes, created: null, reason: "Ese recorrido ya está guardado." };
  }
  const route = createRoute(originId, destinationId);
  return { routes: [route, ...routes], created: route };
}

export function patchRoute(
  routes: FavoriteRoute[],
  id: string,
  patch: Partial<FavoriteRoute>,
): FavoriteRoute[] {
  return routes.map((r) => (r.id === id ? { ...r, ...patch, id: r.id } : r));
}

export function removeRoute(routes: FavoriteRoute[], id: string): FavoriteRoute[] {
  return routes.filter((r) => r.id !== id);
}

export function routesForOrigin(routes: FavoriteRoute[], stationId: string): FavoriteRoute[] {
  return routes.filter((r) => r.originId === stationId && r.alerts);
}

export function isValidRoute(route: FavoriteRoute): boolean {
  const origin = getStation(route.originId);
  const destination = getStation(route.destinationId);
  return Boolean(origin && destination && origin.id !== destination.id);
}

/** "Merlo → Liniers · hacia Once" */
export function describeRoute(route: FavoriteRoute): {
  originName: string;
  destinationName: string;
  sentidoLabel: string;
  lineLabel: string;
  valid: boolean;
} {
  const origin = getStation(route.originId);
  const destination = getStation(route.destinationId);
  if (!origin || !destination || origin.id === destination.id) {
    return {
      originName: route.originId,
      destinationName: route.destinationId,
      sentidoLabel: "—",
      lineLabel: "—",
      valid: false,
    };
  }
  const direction = resolveDirection(origin, destination);
  return {
    originName: origin.name,
    destinationName: destination.name,
    sentidoLabel: direction.label,
    lineLabel: "Línea Sarmiento",
    valid: true,
  };
}

export function sortedRoutes(routes: FavoriteRoute[]): FavoriteRoute[] {
  return [...routes].sort((a, b) => {
    if (a.alerts !== b.alerts) return a.alerts ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
}

/** First run seeds the example trip from the brief so the app is usable at once. */
export function seedRoutes(): FavoriteRoute[] {
  const origin = requireStation("merlo");
  const destination = requireStation("liniers");
  return [createRoute(origin.id, destination.id)];
}
