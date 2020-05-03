export const ROOM_UPDATED = 'room/updated';
export const DELETE_ROOM = 'room/delete';
export const FETCH_ROOM = 'room/fetch';
export const JOIN_ROOM = 'room/join';
export const LEAVE_ROOM = 'room/leave';
export const SUBMIT_RESULT = 'room/submit_result';
export const NEW_RESULT = 'room/new_result';
export const USER_JOIN = 'room/user_join';
export const USER_LEFT = 'room/user_left';
export const NEW_ATTEMPT = 'room/new_attempt';
export const UPDATE_ADMIN = 'room/update_admin';
export const REQUEST_SCRAMBLE = 'room/request_scramble';
export const CHANGE_EVENT = 'room/change_event';
export const SEND_STATUS = 'room/send_status';
export const RECEIVE_STATUS = 'room/receive_status';
export const UPDATE_COMPETING = 'room/update_competing';
export const UPDATE_COMPETING_FOR_USER = 'room/update_competing_for_user';
export const EDIT_ROOM = 'room/edit_room';
export const TIMER_FOCUSED = 'room/timer_focused';

export const roomUpdated = (room) => ({
  type: ROOM_UPDATED,
  fetching: false,
  room,
});

export const fetchRoom = (id) => ({
  type: FETCH_ROOM,
  fetching: true,
  id,
});

export const deleteRoom = (id) => ({
  type: DELETE_ROOM,
  id,
});

export const joinRoom = (id, password) => ({
  type: JOIN_ROOM,
  id,
  password,
});

// We're submitting a new result
export const submitResult = (result) => ({
  type: SUBMIT_RESULT,
  result,
});

// A new result came in
export const newResult = (result) => ({
  type: NEW_RESULT,
  result,
});

// We got a new attempt (scramble)
export const newAttempt = (attempt, waitingFor) => ({
  type: NEW_ATTEMPT,
  attempt,
  waitingFor,
});

export const sendStatus = (status) => ({
  type: SEND_STATUS,
  status,
});

export const receiveStatus = (user, status) => ({
  type: RECEIVE_STATUS,
  user,
  status,
});

export const leaveRoom = () => ({
  type: LEAVE_ROOM,
});

export const userJoined = (user) => ({
  type: USER_JOIN,
  user,
});

export const userLeft = (user) => ({
  type: USER_LEFT,
  user,
});

export const updateAdmin = (admin) => ({
  type: UPDATE_ADMIN,
  admin,
});

export const requestNewScramble = (admin) => ({
  type: REQUEST_SCRAMBLE,
  admin,
});

export const changeEvent = (event) => ({
  type: CHANGE_EVENT,
  event,
});

export const updateCompeting = (competing) => ({
  type: UPDATE_COMPETING,
  competing,
});

export const updateCompetingForUser = (userId, competing) => ({
  type: UPDATE_COMPETING_FOR_USER,
  userId,
  competing,
});

export const editRoom = (options) => ({
  type: EDIT_ROOM,
  options,
});

export const timerFocused = (focus) => ({
  type: TIMER_FOCUSED,
  focus,
});
