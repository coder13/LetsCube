export const CREATE_ROOM = 'rooms/create';
export const ROOMS_UPDATED = 'rooms/updated';
export const ROOMS_FETCHING = 'rooms/fetching';
export const ROOM_CREATED = 'rooms/created';
export const ROOM_DELETED = 'rooms/deleted';

export const roomsUpdated = (rooms) => ({
  type: ROOMS_UPDATED,
  fetching: false,
  rooms,
});

export const fetchingRooms = () => ({
  type: ROOMS_FETCHING,
  fetching: true,
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

export const fetchRooms = () => (dispatch) => {
  dispatch(fetchingRooms());
  return fetch('/api/rooms')
    .then((res) => res.json())
    .then((data) => dispatch(roomsUpdated(data)));
};
