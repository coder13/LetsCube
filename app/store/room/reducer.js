import {
  ROOM_UPDATED,
  ROOM_FETCHING,
  USER_JOIN,
  USER_LEFT,
  NEW_ATTEMPT,
  LEAVE_ROOM,
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
};

const reducers = {
  [ROOM_UPDATED]: (state, action) => {
    return Object.assign({}, state, {
      fetching: false,
      ...action.room
    })
  },
  [ROOM_FETCHING]: (state, action) =>
    Object.assign({}, state, {
      fetching: true
    }),
  [USER_JOIN]: (state, action) =>
    Object.assign({}, state, {
      users: state.users.concat(action.user)
    }),
  [USER_LEFT]: (state, action) => {
    return Object.assign({}, state, {
      users: state.users.filter(user => user.id !== action.user)
    })},
  [NEW_ATTEMPT]: (state, action) =>
    Object.assign({}, state, {
      attempts: Object.assign(state.attempts, {
        [state.attempts.length - 1]: Object.assign(state.attempts[state.attempts.length - 1], action.attempt)
      })
    }),
  [LEAVE_ROOM]: (state, action) =>
    Object.assign({}, state, {
      room: null
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