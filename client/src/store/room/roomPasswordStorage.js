export const ROOM_PASSWORD_STORAGE_PREFIX = 'letscube.roomPassword.v1.';

const passwords = new Map();

const storageKey = (roomId) => {
  if ((typeof roomId !== 'string' && typeof roomId !== 'number')
    || String(roomId).length === 0) {
    throw new Error('A room password requires a room ID.');
  }

  return `${ROOM_PASSWORD_STORAGE_PREFIX}${encodeURIComponent(String(roomId))}`;
};

export const readRoomPassword = (roomId) => {
  storageKey(roomId);
  return passwords.get(String(roomId)) || null;
};

export const persistRoomPassword = (roomId, password) => {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Cannot save an empty room password.');
  }

  storageKey(roomId);
  passwords.set(String(roomId), password);
  return password;
};

export const clearRoomPassword = (roomId) => {
  storageKey(roomId);
  passwords.delete(String(roomId));
};

export const purgeLegacyRoomPasswords = (storage) => {
  if (!storage) return;

  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key && key.startsWith(ROOM_PASSWORD_STORAGE_PREFIX)) {
      storage.removeItem(key);
    }
  }
};
