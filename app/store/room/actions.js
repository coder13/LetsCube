export const ROOM_UPDATED     = 'room/updated';
export const ROOM_FETCHING    = 'room/fetching';
export const FETCH_ROOM       = 'room/fetch';
export const UPDATE_ATTEMPTS  = 'room/update_attempts';
export const SUBMIT_ATTEMPT   = 'room/submit_attempt';
export const NEW_ATTEMPT      = 'room/new_attempt';

export const roomUpdated = room => ({
  type: ROOM_UPDATED,
  fetching: false,
  room: room,
});

export const fetchingRoom = () => ({
  type: ROOM_FETCHING,
  fetching: true,
});

export const fetchRoom = id => ({
  type: FETCH_ROOM,
  id,
});

export const updateAttempts = attempts => ({
  type: UPDATE_ATTEMPTS,
  attempts,
});

export const submitAttempt = attempt => ({
  type: SUBMIT_ATTEMPT,
  attempt,
});

export const newAttempt = attempt => ({
  type: NEW_ATTEMPT,
  attempt,
});