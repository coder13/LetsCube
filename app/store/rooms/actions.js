export const ROOMS_UPDATED    = 'rooms/updated';
export const ROOMS_FETCHING   = 'rooms/fetching';
export const ROOMS_CREATED    = 'rooms/created';
export const ROOMS_DESTROYED  = 'rooms/destroyed';

export const roomsUpdated = rooms => ({
  type: ROOMS_UPDATED,
  fetching: false,
  rooms: rooms
})

export const fetchingRooms = () => ({
  type: ROOMS_FETCHING,
  fetching: true
});

export const fetchRooms = () =>
  dispatch => {
    dispatch(fetchingRooms());
    return fetch('/api/rooms')
      .then(res => res.json())
      .then(data => dispatch(roomsUpdated(data)))
  }