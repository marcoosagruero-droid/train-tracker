/**
 * Trenes service worker.
 *
 * Deliberately caches NOTHING: it exists so notifications can be displayed from
 * the background (Android Chrome only allows `registration.showNotification`
 * through a service worker) and so a tap on the notification opens the app.
 */

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});

// No fetch handler on purpose: the app must always load the latest bundle.
self.addEventListener("fetch", () => {});
