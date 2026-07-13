/** @jest-environment node */

jest.mock('./providers/cubing', () => ({
  generateCubingScramble: jest.fn(),
}));
jest.mock('./providers/scrambow', () => ({
  generateScrambowScramble: jest.fn(),
}));

const events = require('./events.json');
const { generateScramble } = require('./index');
const { generateCubingScramble } = require('./providers/cubing');
const { generateScrambowScramble } = require('./providers/scrambow');

const cubingEventIds = [
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
];

describe('generateScramble', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    generateCubingScramble.mockResolvedValue('cubing scramble');
    generateScrambowScramble.mockReturnValue('scrambow scramble');
  });

  it.each(cubingEventIds)('uses cubing.js for %s', async (eventId) => {
    await expect(generateScramble(eventId)).resolves.toBe('cubing scramble');

    expect(generateCubingScramble).toHaveBeenCalledWith(eventId);
    expect(generateScrambowScramble).not.toHaveBeenCalled();
  });

  it('uses Scrambow for the custom practice events', async () => {
    await expect(generateScramble('clock-optimal')).resolves.toBe('scrambow scramble');
    await expect(generateScramble('pll')).resolves.toBe('scrambow scramble');
    await expect(generateScramble('zbll')).resolves.toBe('scrambow scramble');
    await expect(generateScramble('lse')).resolves.toBe('scrambow scramble');
    await expect(generateScramble('ru')).resolves.toBe('scrambow scramble');

    expect(generateScrambowScramble).toHaveBeenNthCalledWith(1, 'clock-optimal');
    expect(generateScrambowScramble).toHaveBeenNthCalledWith(2, 'pll');
    expect(generateScrambowScramble).toHaveBeenNthCalledWith(3, 'zbll');
    expect(generateScrambowScramble).toHaveBeenNthCalledWith(4, 'lse');
    expect(generateScrambowScramble).toHaveBeenNthCalledWith(5, 'ru');
  });

  it('rejects events that are not in the shared catalog', async () => {
    await expect(generateScramble('unknown')).rejects.toThrow('Unsupported scramble event: unknown');

    expect(generateCubingScramble).not.toHaveBeenCalled();
    expect(generateScrambowScramble).not.toHaveBeenCalled();
  });

  it('surfaces cubing.js failures without using Scrambow', async () => {
    const error = new Error('cubing worker failed');
    generateCubingScramble.mockRejectedValue(error);

    await expect(generateScramble('333')).rejects.toBe(error);
    expect(generateScrambowScramble).not.toHaveBeenCalled();
  });
});

describe('events', () => {
  it('contains every event supported by the generator', () => {
    expect(events.map(({ id }) => id)).toEqual(expect.arrayContaining([
      ...cubingEventIds,
      'clock-optimal',
      'pll',
      'zbll',
      'lse',
      'ru',
    ]));
  });

  it('does not expose provider implementation details', () => {
    events.forEach((event) => {
      expect(event).toEqual(expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        group: expect.any(String),
      }));
      expect(event.scrambler).toBeUndefined();
    });
  });
});
