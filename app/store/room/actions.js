export const ROOM_UPDATED     = 'room/updated';
export const ROOM_FETCHING    = 'room/fetching';
export const FETCH_ROOM       = 'room/fetch';
export const JOIN_ROOM        = 'room/join';
export const LEAVE_ROOM       = 'room/leave';
export const UPDATE_ATTEMPTS  = 'room/update_attempts';
export const SUBMIT_ATTEMPT   = 'room/submit_attempt';
export const USER_JOIN        = 'room/user_join';
export const USER_LEFT        = 'room/user_left';
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

export const joinRoom = (accessCode) => ({
  type: JOIN_ROOM,
  accessCode
})

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

export const leaveRoom = () => ({
  type: LEAVE_ROOM
});

export const userJoined = user => ({
  type: USER_JOIN,
  user
});

export const userLeft = user => ({
  type: USER_LEFT,
  user
});