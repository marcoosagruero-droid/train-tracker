import type { NotifyPayload } from "./types";

export type NotifyResult = "shown" | "denied" | "unsupported" | "error";

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

/**
 * The service worker exists so notifications can be shown from the background
 * (Android Chrome requires `registration.showNotification`). It deliberately
 * caches nothing, so it never interferes with app updates.
 */
export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }
  if (registrationPromise) return registrationPromise;

  registrationPromise = navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((registration) => registration)
    .catch((error) => {
      console.warn("[Trenes] service worker no disponible:", error);
      return null;
    });

  return registrationPromise;
}

/**
 * NotificationManager (web).
 * Tries the service worker first (works with the tab in the background),
 * falls back to the plain constructor.
 */
export async function showNotification(payload: NotifyPayload): Promise<NotifyResult> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission !== "granted") return "denied";

  const options: NotificationOptions = {
    body: payload.body,
    tag: payload.tag,
    icon: "/logo.svg",
    badge: "/logo.svg",
    data: payload.data ?? {},
    requireInteraction: false,
    silent: false,
  };

  const registration = await registerServiceWorker();

  try {
    if (registration) {
      await registration.showNotification(payload.title, options);
      return "shown";
    }
  } catch (error) {
    console.warn("[Trenes] showNotification falló, intento directo:", error);
  }

  try {
    new Notification(payload.title, options);
    return "shown";
  } catch {
    return "error";
  }
}

/** Opens/focuses the app when the user taps a notification. */
export function handleNotificationClick(path = "/dashboard"): void {
  if (typeof window === "undefined") return;
  if (document.visibilityState === "visible") {
    window.focus();
  }
  window.location.href = path;
}
