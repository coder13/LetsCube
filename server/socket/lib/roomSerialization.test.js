const {
  mapToObject,
  serializeAttempt,
  serializeRoomMask,
} = require('./roomSerialization');

describe('room socket serialization', () => {
  it('serializes maps with string keys', () => {
    expect(mapToObject(new Map([[8184, true]]))).toEqual({ 8184: true });
  });

  it('serializes attempt result maps', () => {
    expect(serializeAttempt({
      id: 0,
      results: new Map([['8184', { time: 1234 }]]),
    })).toEqual({
      id: 0,
      results: { 8184: { time: 1234 } },
    });
  });

  it('serializes room state used by the browser timer', () => {
    expect(serializeRoomMask({
      competing: new Map([['8184', true]]),
      waitingFor: new Map([['8184', true]]),
      attempts: [{ results: new Map([['8184', { time: 1234 }]]) }],
    }, ['competing', 'waitingFor', 'attempts'])).toEqual({
      competing: { 8184: true },
      waitingFor: { 8184: true },
      attempts: [{ results: { 8184: { time: 1234 } } }],
    });
  });
});
