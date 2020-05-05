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
  statuses: {},
  attempts: [],
  competing: {},
  waitingFor: [],
  admin: {
    id: null,
  },
};

const reducers = {
  [ROOM_UPDATED]: (state, action) => ({
    ...state,
    fetching: false,
    ...action.room,
  }),
  [FETCH_ROOM]: (state, action) => ({
    ...state,
    fetching: action.fetching,
  }),
  [USER_JOIN]: (state, action) => ({
    ...state,
    users: state.users.concat(action.user),
    competing: {
      ...state.competing,
      [action.user.id]: true,
    },
  }),
  [USER_LEFT]: (state, action) => ({
    ...state,
    users: state.users.filter((user) => user.id !== action.user),
  }),
  [JOIN_ROOM]: (state, action) => ({ ...state, password: action.password }),
  [LEAVE_ROOM]: (state) => ({
    ...state,
    name: undefined,
    _id: undefined,
    accessCode: undefined,
    users: [],
    statuses: {},
    attempts: [],
    competing: {},
    waitingFor: [],
    admin: {
      id: null,
    },
  }),
  [NEW_ATTEMPT]: (state, action) => ({
    ...state,
    attempts: state.attempts.concat(action.attempt),
    waitingFor: action.waitingFor,
    new_scramble: true,
  }),
  [NEW_RESULT]: (state, action) => ({
    ...state,
    attempts: state.attempts.map((attempt) => {
      if (attempt.id === action.result.id) {
        return {
          ...attempt,
          results: { ...attempt.results, [action.result.userId]: action.result.result },
        };
      }

      return attempt;
    }),
    // remove user from waiting for for current attempt
    waitingFor: state.waitingFor.filter((user) => user !== action.result.userId),
  }),
  [EDIT_RESULT]: (state, action) => ({
    ...state,
    attempts: state.attempts.map((attempt) => {
      if (attempt.id === action.result.id) {
        return {
          ...attempt,
          results: { ...attempt.results, [action.result.userId]: action.result.result },
        };
      }

      return attempt;
    }),
  }),
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
};

// Socket reducer
function roomReducer(state = INITIAL_STATE, action) {
  if (reducers[action.type]) {
    return reducers[action.type](state, action);
  }
  return state;
}

export default roomReducer;
