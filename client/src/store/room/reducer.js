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
} from './actions';
import { calculatePointsForAttempt, calculatePointsForAllAttempts } from '../../lib/stats';

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
  waitingFor: [],
  admin: {
    id: null,
  },
  type: 'normal',
<<<<<<< HEAD
  requireRevealedIdentity: false,
  startTime: null,
=======
>>>>>>> 3256ce26e9422e30435f66ac6470dcbbe036d738
  timerFocused: true,
};

const reducers = {
  [ROOM_UPDATED]: (state, { room }) => {
<<<<<<< HEAD
    const attempts = room.attempts ? room.attempts.map((attempt) => ({
      ...attempt,
      points: calculatePointsForAttempt(room.type, attempt.results),
    })) : [];
=======
    const attempts = room.attempts.map((attempt) => ({
      ...attempt,
      points: calculatePointsForAttempt(room.type, attempt.results),
    }));
>>>>>>> 3256ce26e9422e30435f66ac6470dcbbe036d738

    const points = calculatePointsForAllAttempts(attempts);

    return {
      ...state,
      fetching: false,
      ...room,
      attempts,
      points,
<<<<<<< HEAD
      startTime: room.startTime,
=======
>>>>>>> 3256ce26e9422e30435f66ac6470dcbbe036d738
    };
  },
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
  [NEW_RESULT]: (state, action) => {
    const attempts = state.attempts.map((attempt) => {
      if (attempt.id === action.result.id) {
        const newAttempt = {
          ...attempt,
          results: { ...attempt.results, [action.result.userId]: action.result.result },
        };

        newAttempt.points = calculatePointsForAttempt(state.type, newAttempt.results);

        return newAttempt;
      }

      return attempt;
    });

    const points = calculatePointsForAllAttempts(attempts);

    return {
      ...state,
      attempts,
      points,
      waitingFor: state.waitingFor.filter((user) => user !== action.result.userId),
    };
  },
  [EDIT_RESULT]: (state, action) => {
    const attempts = state.attempts.map((attempt) => {
      if (attempt.id === action.result.id) {
        const newAttempt = {
          ...attempt,
          results: { ...attempt.results, [action.result.userId]: action.result.result },
        };

        newAttempt.points = calculatePointsForAttempt(state.type, newAttempt.results);

        return newAttempt;
      }

      return attempt;
    });

    const points = calculatePointsForAllAttempts(attempts);

    return {
      ...state,
      attempts,
      points,
    };
  },
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
};

// Socket reducer
function roomReducer(state = INITIAL_STATE, action) {
  if (reducers[action.type]) {
    return reducers[action.type](state, action);
  }
  return state;
}

export default roomReducer;
