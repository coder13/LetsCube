export const ROOMS_CONNECT = 'rooms/connect';
export const ROOMS_DISCONNECT = 'rooms/disconnect';
export const ROOMS_CONNECTED = 'rooms/connected';
export const ROOMS_DISCONNECTED = 'rooms/disconnected';
export const ROOMS_CONNECTION_CHANGED = 'rooms/connection_changed';
export const CREATE_ROOM = 'rooms/create';
export const ROOMS_UPDATED = 'rooms/updated';
export const ROOM_CREATED = 'rooms/created';
export const ROOM_DELETED = 'rooms/deleted';
export const ROOM_UPDATED = 'rooms/room_updated';

export const connectionChanged = (isConnected) => ({
  type: ROOMS_CONNECTION_CHANGED,
  connected: isConnected,
  isError: false,
  reconnecting: false,
});

export const connectSocket = () => ({
  type: ROOMS_CONNECT,
});

export const disconnectSocket = () => ({
  type: ROOMS_DISCONNECT,
});

export const connected = () => ({
  type: ROOMS_CONNECTED,
  connected: true,
});

export const disconnected = () => ({
  type: ROOMS_DISCONNECTED,
  connected: false,
});

export const roomsUpdated = (rooms) => ({
  type: ROOMS_UPDATED,
  fetching: false,
  rooms,
});

export const roomCreated = (room) => ({
  type: ROOM_CREATED,
  room,
});

export const roomUpdated = (room) => ({
  type: ROOM_UPDATED,
  room,
});

export const roomDeleted = (room) => ({
  type: ROOM_DELETED,
  room,
});

export const createRoom = (options) => ({
  type: CREATE_ROOM,
  options,
});
