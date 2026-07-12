const events = require('./events');
const { generateCubingScramble } = require('./providers/cubing');
const { generateScrambowScramble } = require('./providers/scrambow');

const cubingEventIds = new Set([
  '222',
  '333',
  '333bf',
  '333oh',
  '333ft',
  '444',
  '444bf',
  '555',
  '555bf',
  '666',
  '777',
  'minx',
  'pyram',
  'clock',
  'skewb',
  'sq1',
  'fto',
]);

const scrambowTypesByEventId = {
  333: '333',
  222: '222',
  444: '444',
  555: '555',
  666: '666',
  777: '777',
  '333bf': '333',
  '333oh': '333',
  '333ft': '333',
  minx: 'minx',
  pyram: 'pyram',
  clock: 'clock',
  'clock-optimal': 'clock-optimal',
  skewb: 'skewb',
  sq1: 'sq1',
  '444bf': '444',
  '555bf': '555',
  fto: 'fto',
  pll: 'pll',
  zbll: 'zbll',
  lse: 'lse',
  ru: 'ru',
};

const knownEventIds = new Set(events.map(({ id }) => id));

async function generateScramble(eventId) {
  if (!knownEventIds.has(eventId)) {
    throw new Error(`Unsupported scramble event: ${eventId}`);
  }

  if (cubingEventIds.has(eventId)) {
    return generateCubingScramble(eventId);
  }

  return generateScrambowScramble(scrambowTypesByEventId[eventId]);
}

module.exports = { generateScramble };
