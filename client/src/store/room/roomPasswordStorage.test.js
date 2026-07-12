import {
  ROOM_PASSWORD_STORAGE_PREFIX,
  clearRoomPassword,
  persistRoomPassword,
  readRoomPassword,
} from './roomPasswordStorage';

describe('private room password storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('stores passwords separately for each room', () => {
    persistRoomPassword('room-one', 'first-password');
    persistRoomPassword('room-two', 'second-password');

    expect(readRoomPassword('room-one')).toBe('first-password');
    expect(readRoomPassword('room-two')).toBe('second-password');
    expect(window.localStorage.getItem(
      `${ROOM_PASSWORD_STORAGE_PREFIX}room-one`,
    )).toBe('first-password');
  });

  it('clears a password without affecting other rooms', () => {
    persistRoomPassword('room-one', 'first-password');
    persistRoomPassword('room-two', 'second-password');

    clearRoomPassword('room-one');

    expect(readRoomPassword('room-one')).toBeNull();
    expect(readRoomPassword('room-two')).toBe('second-password');
  });

  it('rejects missing room IDs and empty passwords', () => {
    expect(() => persistRoomPassword(null, 'secret')).toThrow('room ID');
    expect(() => persistRoomPassword('room-one', '')).toThrow('empty room password');
  });
});
