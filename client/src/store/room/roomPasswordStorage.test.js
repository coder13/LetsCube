import {
  ROOM_PASSWORD_STORAGE_PREFIX,
  clearRoomPassword,
  persistRoomPassword,
  purgeLegacyRoomPasswords,
  readRoomPassword,
} from './roomPasswordStorage';

describe('private room password storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearRoomPassword('room-one');
    clearRoomPassword('room-two');
  });

  it('keeps passwords in memory for the current tab only', () => {
    persistRoomPassword('room-one', 'first-password');
    persistRoomPassword('room-two', 'second-password');

    expect(readRoomPassword('room-one')).toBe('first-password');
    expect(readRoomPassword('room-two')).toBe('second-password');
    expect(window.localStorage.getItem(
      `${ROOM_PASSWORD_STORAGE_PREFIX}room-one`,
    )).toBeNull();
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

  it('removes passwords saved by older versions', () => {
    window.localStorage.setItem(`${ROOM_PASSWORD_STORAGE_PREFIX}room-one`, 'legacy-secret');
    window.localStorage.setItem('unrelated', 'keep');

    purgeLegacyRoomPasswords(window.localStorage);

    expect(window.localStorage.getItem(`${ROOM_PASSWORD_STORAGE_PREFIX}room-one`)).toBeNull();
    expect(window.localStorage.getItem('unrelated')).toBe('keep');
  });
});
