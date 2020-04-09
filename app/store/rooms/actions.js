export const CREATE_ROOM = 'rooms/create';
export const ROOMS_UPDATED = 'rooms/updated';
export const ROOM_CREATED = 'rooms/created';
export const ROOM_DELETED = 'rooms/deleted';

export const roomsUpdated = (rooms) => ({
  type: ROOMS_UPDATED,
  fetching: false,
  rooms,
});

export const roomCreated = (room) => ({
  type: ROOM_CREATED,
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
