let cubingModulesPromise;

function loadCubingModules() {
  if (!cubingModulesPromise) {
    cubingModulesPromise = Promise.all([
      // cubing publishes ESM-only subpath exports, which eslint-plugin-import 2.20 cannot resolve.
      // eslint-disable-next-line import/no-unresolved
      import('cubing/scramble'),
      // eslint-disable-next-line import/no-unresolved
      import('cubing/search'),
    ]).then(([scramble, search]) => {
      search.setSearchDebug({
        logPerf: false,
        scramblePrefetchLevel: 'none',
        showWorkerInstantiationWarnings: false,
      });
      return scramble;
    });
  }

  return cubingModulesPromise;
}

async function generateCubingScramble(eventId) {
  const { randomScrambleForEvent } = await loadCubingModules();
  return (await randomScrambleForEvent(eventId)).toString();
}

module.exports = { generateCubingScramble };
