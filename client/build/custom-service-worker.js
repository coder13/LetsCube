importScripts("/precache-manifest.8d0d84c9c2f0440f9efa3bffdb7ae1c4.js", "https://storage.googleapis.com/workbox-cdn/releases/4.3.1/workbox-sw.js");

workbox.precaching.precacheAndRoute(self.__precacheManifest);

addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    skipWaiting();
  }
});

workbox.routing.registerRoute(
  /api/,
  new workbox.strategies.NetworkFirst({
    cacheName: "currencies",
    plugins: [
      new workbox.expiration.Plugin({
        maxAgeSeconds: 10 * 60 // 10 minutes
      })
    ]
  })
);

workbox.routing.registerRoute(
  /auth/,
  new workbox.strategies.NetworkFirst({
    cacheName: "currencies",
    plugins: [
      new workbox.expiration.Plugin({
        maxAgeSeconds: 10 * 60 // 10 minutes
      })
    ]
  })
);
