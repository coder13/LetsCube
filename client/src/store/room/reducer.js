import {
  ROOM_UPDATED,
  FETCH_ROOM,
  USER_JOIN,
  USER_LEFT,
  LEAVE_ROOM,
  JOIN_ROOM,
  NEW_ATTEMPT,
  NEW_RESULT,
  EDIT_RESULT,
  SEND_EDIT_RESULT,
  UPDATE_ADMIN,
  RECEIVE_STATUS,
  UPDATE_COMPETING_FOR_USER,
  TIMER_FOCUSED,
  UPDATE_USER_BANNED,
  NEXT_SOLVE_AT,
  TOGGLE_FOLLOW_USER,
} from './actions';

const INITIAL_STATE = {
  fetching: null,
  _id: null,
  name: null,
  event: null,
  accessCode: null,
  private: null,
  password: null, // for reconnecting
  users: [],
  usersInRoom: [],
  statuses: {},
  attempts: [],
  competing: {},
  inRoom: {},
  banned: {},
  registered: {},
  waitingFor: [],
  admin: {
    id: null,
  },
  type: 'normal',
  requireRevealedIdentity: false,
  startTime: null,
  started: null,
  nextSolveAt: null,
  timerFocused: true,
  following: {},
};

const editResult = (state, action) => ({
  ...state,
  attempts: state.attempts.map((attempt) => (
    attempt.id === action.result.id ? ({
      ...attempt,
      results: { ...attempt.results, [action.result.userId]: action.result.result },
    }) : attempt
  )),
  waitingFor: state.waitingFor.filter((user) => user !== action.result.userId),
});

const reducers = {
  [ROOM_UPDATED]: (state, { room }) => ({
    ...state,
    fetching: false,
    ...room,
  }),
  [FETCH_ROOM]: (state, action) => ({
    ...state,
    fetching: action.fetching,
  }),
  [USER_JOIN]: (state, action) => ({
    ...state,
    users: [...state.users.filter((i) => +i.id !== action.user.id), action.user],
    competing: {
      ...state.competing,
      [action.user.id]: true,
    },
    inRoom: {
      ...state.inRoom,
      [action.user.id]: true,
    },
  }),
  [USER_LEFT]: (state, action) => ({
    ...state,
    inRoom: {
      ...state.inRoom,
      [action.user]: false,
    },
  }),
  [JOIN_ROOM]: (state, action) => ({ ...state, password: action.password }),
  [LEAVE_ROOM]: () => ({
    ...INITIAL_STATE,
  }),
  [NEW_ATTEMPT]: (state, action) => ({
    ...state,
    attempts: state.attempts.concat(action.attempt),
    waitingFor: action.waitingFor,
    new_scramble: true,
  }),
  [NEW_RESULT]: editResult,
  [EDIT_RESULT]: editResult,
  [SEND_EDIT_RESULT]: (state) => state,
  [UPDATE_ADMIN]: (state, action) => ({ ...state, admin: action.admin }),
  [RECEIVE_STATUS]: (state, action) => ({
    ...state,
    statuses: { ...state.statuses, [action.user]: action.status },
  }),
  [UPDATE_COMPETING_FOR_USER]: (state, action) => ({
    ...state,
    competing: {
      ...state.competing,
      [action.userId]: action.competing,
    },
    // remove user from waiting for for current attempt
    waitingFor: action.competing
      ? state.waitingFor
      : state.waitingFor.filter((user) => user !== action.userId),
  }),
  [TIMER_FOCUSED]: (state, action) => ({
    ...state,
    timerFocused: action.focus,
  }),
  [UPDATE_USER_BANNED]: (state, action) => ({
    ...state,
    banned: {
      ...state.banned,
      [action.userId]: action.banned,
    },
  }),
  [NEXT_SOLVE_AT]: (state, action) => ({
    ...state,
    nextSolveAt: action.dateTime,
  }),
  [TOGGLE_FOLLOW_USER]: (state, action) => ({
    ...state,
    following: {
      ...state.following,
      [action.userId]: !state.following[action.userId],
    },
  }),
};

// Socket reducer
function roomReducer(state = INITIAL_STATE, action) {
  if (reducers[action.type]) {
    return reducers[action.type](state, action);
  }
  return state;
}

export default roomReducer;
