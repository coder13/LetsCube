export const ROOM_UPDATED     = 'room/updated';
export const ROOM_FETCHING    = 'room/fetching';
export const DELETE_ROOM      = 'room/delete';
export const FETCH_ROOM       = 'room/fetch';
export const JOIN_ROOM        = 'room/join';
export const LEAVE_ROOM       = 'room/leave';
export const UPDATE_ATTEMPTS  = 'room/update_attempts';
export const SUBMIT_RESULT    = 'room/submit_result';
export const NEW_RESULT       = 'room/new_result';
export const USER_JOIN        = 'room/user_join';
export const USER_LEFT        = 'room/user_left';
export const NEW_ATTEMPT      = 'room/new_attempt';
export const UPDATE_ADMIN     = 'room/update_admin';

export const roomUpdated = room => ({
  type: ROOM_UPDATED,
  fetching: false,
  room,
});

export const fetchingRoom = () => ({
  type: ROOM_FETCHING,
  fetching: true,
});

export const fetchRoom = id => ({
  type: FETCH_ROOM,
  id,
});

export const deleteRoom = id => ({
  type: DELETE_ROOM,
  id,
})

export const joinRoom = (accessCode) => ({
  type: JOIN_ROOM,
  accessCode
})

// Maybe not needed
export const updateAttempts = attempts => ({
  type: UPDATE_ATTEMPTS,
  attempts,
});

// We're submitting a new result
export const submitResult = result => ({
  type: SUBMIT_RESULT,
  result,
});

// A new result came in
export const newResult = result => ({
  type: NEW_RESULT,
  result,
});

// We got a new attempt (scramble)
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

export const updateAdmin = admin => ({
  type: UPDATE_ADMIN,
  admin
});