/* eslint-env jest */

const { isRoomTypeEnabled } = require('./roomAvailability');

describe('room type availability', () => {
  it('always exposes normal rooms', () => {
    expect(isRoomTypeEnabled('normal', false)).toBe(true);
    expect(isRoomTypeEnabled('normal', true)).toBe(true);
  });

  it('exposes Grand Prix rooms only when explicitly enabled', () => {
    expect(isRoomTypeEnabled('grand_prix', false)).toBe(false);
    expect(isRoomTypeEnabled('grand_prix', true)).toBe(true);
  });
});
