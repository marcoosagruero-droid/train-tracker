import type { GeoStatus, PermissionKind } from "./types";

/**
 * Progressive permission flow.
 *
 * The wording is the one requested in the brief; each step explains why the
 * permission is needed before the browser/OS prompt appears.
 */

export const PERMISSION_COPY = {
  intro: {
    title: "Alertas por proximidad",
    body: "Para avisarte cuando estés cerca de una estación, Trenes necesita utilizar tu ubicación incluso cuando la aplicación no esté abierta.",
    bullets: [
      "Se usa únicamente para detectar que estás cerca del origen de tus recorridos guardados.",
      "Tu ubicación no se envía a servidores ni se guarda con historial.",
      "Podés desactivar las alertas en cualquier momento desde Ajustes.",
    ],
    primary: "Activar alertas",
    secondary: "Ahora no",
  },
  location: {
    title: "Permiso de ubicación",
    body: "Android y el navegador usan GPS y redes para calcular a qué distancia estás de cada estación.",
  },
  background: {
    title: "Ubicación en segundo plano",
    body: "Para que la alerta funcione con la pantalla apagada o con la app cerrada hace falta que la ubicación siga disponible en segundo plano. Si lo rechazás, la app funciona igual, pero las alertas automáticas no podrán dispararse con la app cerrada.",
  },
  notifications: {
    title: "Notificaciones",
    body: "Sin permiso de notificaciones no podemos avisarte del próximo tren, aunque detectemos la estación.",
  },
} as const;

export function supportsPermissionsApi(): boolean {
  return typeof navigator !== "undefined" && "permissions" in navigator;
}

export function supportsGeolocation(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

export function supportsNotifications(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function queryLocationPermission(): Promise<PermissionKind> {
  if (!supportsGeolocation()) return "unsupported";
  if (!supportsPermissionsApi()) return "prompt";
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return mapStatus(status.state);
  } catch {
    return "prompt";
  }
}

export async function queryNotificationPermission(): Promise<PermissionKind> {
  if (!supportsNotifications()) return "unsupported";
  return mapStatus(Notification.permission as PermissionState);
}

function mapStatus(state: PermissionState | string): PermissionKind {
  if (state === "granted") return "granted";
  if (state === "denied") return "denied";
  return "prompt";
}

/** Wrapped `getCurrentPosition` → PermissionKind. */
export function requestLocationPermission(): Promise<PermissionKind> {
  return new Promise((resolve) => {
    if (!supportsGeolocation()) {
      resolve("unsupported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => resolve("granted"),
      (error) => resolve(error.code === error.PERMISSION_DENIED ? "denied" : "granted"),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  });
}

export async function requestNotificationPermission(): Promise<PermissionKind> {
  if (!supportsNotifications()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  try {
    const result = await Notification.requestPermission();
    return result === "granted" ? "granted" : result === "denied" ? "denied" : "prompt";
  } catch {
    return "prompt";
  }
}

export type AlertStatusTone = "ok" | "warn" | "error" | "idle";

export interface AlertStatus {
  tone: AlertStatusTone;
  /** Emoji marker used by the status pill (matches the brief). */
  icon: string;
  label: string;
  detail: string;
  fixLabel?: string;
}

export interface StatusInput {
  alertsEnabled: boolean;
  location: PermissionKind;
  notification: PermissionKind;
  geo: GeoStatus;
}

/**
 * Section 14 — location status. Tapping the pill shows `detail` (how to fix).
 */
export function deriveAlertStatus(input: StatusInput): AlertStatus {
  const { alertsEnabled, location, notification, geo } = input;

  if (!alertsEnabled) {
    return {
      tone: "idle",
      icon: "⚪",
      label: "Alertas por proximidad apagadas",
      detail:
        "Activá las alertas en Ajustes para que Trenes te avise cuando te acerques al origen de un recorrido.",
      fixLabel: "Activar alertas",
    };
  }

  if (location === "unsupported" || geo === "unsupported") {
    return {
      tone: "error",
      icon: "🔴",
      label: "Este dispositivo no expone GPS",
      detail:
        "La geolocalización no está disponible en este navegador o contexto. Abrí la app en Chrome/Android para usar las alertas.",
    };
  }

  if (location === "denied" || geo === "permission-denied") {
    return {
      tone: "error",
      icon: "🔴",
      label: "Ubicación desactivada",
      detail:
        "Trenes no tiene permiso de ubicación. Abrí los permisos del sitio o de la app y concedé «Ubicación»; sin ese permiso no se puede detectar la estación cercana.",
      fixLabel: "Volver a pedir permiso",
    };
  }

  if (notification === "denied") {
    return {
      tone: "warn",
      icon: "🟠",
      label: "Falta permiso de notificaciones",
      detail:
        "Detectamos la estación pero no podemos mostrarte el aviso. Permití las notificaciones para este sitio en la configuración del navegador.",
      fixLabel: "Revisar notificaciones",
    };
  }

  if (location === "prompt" || geo === "off" || geo === "starting") {
    return {
      tone: "warn",
      icon: "🟠",
      label: "Falta permiso de ubicación",
      detail:
        "Todavía no concediste el acceso a tu ubicación. Tocalo para autorizarlo y empezar a detectar estaciones cercanas.",
      fixLabel: "Pedir permiso ahora",
    };
  }

  if (geo === "error") {
    return {
      tone: "warn",
      icon: "🟠",
      label: "Buscando señal de GPS",
      detail:
        "La ubicación no está disponible en este momento. Salí a un lugar abierto o esperá unos segundos; seguimos reintentando.",
    };
  }

  if (geo === "watching") {
    return {
      tone: "ok",
      icon: "🟢",
      label: "Alertas por proximidad activadas",
      detail:
        "Vigilamos las estaciones origen de tus recorridos con el radio configurado. La detección sigue funcionando mientras el navegador mantenga el seguimiento de ubicación.",
    };
  }

  return {
    tone: "warn",
    icon: "🟠",
    label: "Seguimiento de ubicación iniciando",
    detail: "Esperando la primera posición para empezar a vigilar las estaciones.",
  };
}
