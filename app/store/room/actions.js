export const ROOM_UPDATED   = 'room/updated';
export const ROOM_FETCHING  = 'room/fetching';
export const FETCH_ROOM     = 'room/fetch';
export const ROOM_CREATED   = 'room/created';
export const ROOM_DESTROYED = 'room/destroyed';

export const roomUpdated = room => ({
  type: ROOM_UPDATED,
  fetching: false,
  room: room
});

export const fetchingRoom = () => ({
  type: ROOM_FETCHING,
  fetching: true
});

export const fetchRoom = id => ({
  type: FETCH_ROOM,
  id: id
});