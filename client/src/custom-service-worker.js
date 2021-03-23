/* eslint-disable */

workbox.precaching.precacheAndRoute(self.__precacheManifest);

addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    skipWaiting();
  }
});

// workbox.routing.registerRoute(
//   /api/,
//   new workbox.strategies.NetworkFirst({
//     cacheName: 'currencies',
//     plugins: [
//       new workbox.expiration.Plugin({
//         maxAgeSeconds: 10 * 60, // 10 minutes
//       }),
//     ],
//   }),
// );

// workbox.routing.registerRoute(
//   /auth/,
//   new workbox.strategies.NetworkFirst({
//     cacheName: 'currencies',
//     plugins: [
//       new workbox.expiration.Plugin({
//         maxAgeSeconds: 10 * 60, // 10 minutes
//       }),
//     ],
//   }),
// );
