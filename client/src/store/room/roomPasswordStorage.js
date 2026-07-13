export const ROOM_PASSWORD_STORAGE_PREFIX = 'letscube.roomPassword.v1.';

const storageKey = (roomId) => {
  if ((typeof roomId !== 'string' && typeof roomId !== 'number')
    || String(roomId).length === 0) {
    throw new Error('A room password requires a room ID.');
  }

  return `${ROOM_PASSWORD_STORAGE_PREFIX}${encodeURIComponent(String(roomId))}`;
};

export const readRoomPassword = (roomId, storage = window.localStorage) => {
  const password = storage.getItem(storageKey(roomId));
  return password || null;
};

export const persistRoomPassword = (
  roomId,
  password,
  storage = window.localStorage,
) => {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Cannot save an empty room password.');
  }

  storage.setItem(storageKey(roomId), password);
  return password;
};

export const clearRoomPassword = (roomId, storage = window.localStorage) => {
  storage.removeItem(storageKey(roomId));
};
