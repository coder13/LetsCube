# `letscube-scrambles`

This private workspace owns Let's Cube's event catalog and server-side scramble
generation. It keeps event metadata shared between browser and server without
cross-importing application source directories.

## Exports

Generate a scramble:

```js
const { generateScramble } = require('letscube-scrambles');

const scramble = await generateScramble('333');
```

The generator is asynchronous for every event because cubing.js is asynchronous.

Read the browser-safe catalog:

```js
import Events from 'letscube-scrambles/events';
```

The catalog subpath exports JSON. Keep it free of provider implementation
details so Vite can consume it as a stable default export.

## Provider Policy

Provider selection is explicit in `index.js`:

- cubing.js is preferred for the events listed in `cubingEventIds`;
- Scrambow handles custom practice events such as PLL, ZBLL, LSE, RU, and
  optimal Clock; and
- unknown event IDs are rejected.

Do not treat Scrambow as a fallback for arbitrary cubing.js failures. A provider
failure should surface so incorrect or degraded scramble generation is visible.

cubing.js publishes ESM-only subpaths. The CommonJS provider uses a cached
dynamic import and disables scramble prefetching for the server process.

## Adding Or Changing An Event

1. Add or update its public `id`, `name`, and `group` in `events.json`.
2. Add the ID to the cubing.js capability set or map it to a Scrambow type.
3. Update routing tests in `index.test.js`.
4. Verify the server awaits scramble generation and the client renders the
   catalog entry.
5. Run a real generation smoke test in addition to mocked unit tests when a
   provider or provider version changes.

## Checks

From the repository root:

```sh
yarn turbo run lint --filter=letscube-scrambles
yarn turbo run test:ci --filter=letscube-scrambles
```

Changes affecting consumers should also run server tests and a production client
build.
