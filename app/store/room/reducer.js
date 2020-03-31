import {
  ROOM_UPDATED,
  ROOM_FETCHING,
  USER_JOIN,
  USER_LEFT,
  NEW_ATTEMPT,
  LEAVE_ROOM,
  NEW_RESULT,
  UPDATE_ADMIN,
} from './actions';

const INITIAL_STATE = {
  fetching: null,
  id: null,
  name: null,
  accessCode: null,
  password: null,
  private: null,
  users: [],
  attempts: [],
  admin: {
    id: null,
  },
};

const reducers = {
  [ROOM_UPDATED]: (state, action) =>
    Object.assign({}, state, {
      fetching: false,
      ...action.room
    }),
  [ROOM_FETCHING]: (state, action) =>
    Object.assign({}, state, {
      fetching: true
    }),
  [USER_JOIN]: (state, action) =>
    Object.assign({}, state, {
      users: state.users.concat(action.user)
    }),
  [USER_LEFT]: (state, action) =>
    Object.assign({}, state, {
      users: state.users.filter(user => user.id !== action.user)
    }),
  [NEW_ATTEMPT]: (state, action) =>
    Object.assign({}, state, {
      attempts: state.attempts.concat(action.attempt),
      new_scramble: true,
    }),
  [LEAVE_ROOM]: (state) =>
    Object.assign({}, state, {
      name: undefined,
      id: undefined,
      accessCode: undefined,
      users: [],
      attempts: [],
      admin: {
        id: null,
      },
    }),
  [NEW_RESULT]: (state, action) =>
    Object.assign({}, state, {
      attempts: state.attempts.map((attempt) => {
        if (attempt.id === action.result.id) {
          return Object.assign({}, attempt, {
            results: Object.assign({}, attempt.results, {
              [action.result.userId]: action.result.result
            })
          });
        }

        return attempt;
      })
    }),
  [UPDATE_ADMIN]: (state, action) =>
    Object.assign({}, state, {
      admin: action.admin
    }),
}

// Socket reducer
function roomReducer(state = INITIAL_STATE, action) {
  if (reducers[action.type]) {
    return reducers[action.type](state, action)
  } else {
    return state;
  }
}

export default roomReducer;