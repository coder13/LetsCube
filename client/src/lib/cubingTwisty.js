const loadTwistyPlayer = () => import(
  // cubing publishes ESM-only subpath exports, which eslint-plugin-import cannot resolve.
  // eslint-disable-next-line import/no-unresolved
  'cubing/twisty'
)
  .then(({ TwistyPlayer }) => TwistyPlayer);

export default loadTwistyPlayer;
