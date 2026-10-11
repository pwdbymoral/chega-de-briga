/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

self.addEventListener("push", (event) => {
  const value = event.data?.json() as { title?: string; body?: string; url?: string; tag?: string } | undefined;
  event.waitUntil(self.registration.showNotification(value?.title ?? "Chega de Briga", {
    body: value?.body ?? "Há atualizações nas tarefas da sua casa.",
    tag: value?.tag ?? "chega-de-briga",
    data: { url: value?.url ?? "/casa" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(String(event.notification.data?.url ?? "/casa"), self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    for (const client of clients) {
      if ("focus" in client) {
        const windowClient = client as WindowClient;
        if ("navigate" in windowClient) await windowClient.navigate(target);
        return windowClient.focus();
      }
    }
    return self.clients.openWindow(target);
  }));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode !== "navigate" || new URL(request.url).pathname.startsWith("/api/")) return;
  event.respondWith(fetch(request).catch(async () => (await caches.match("/index.html")) ?? Response.error()));
});
