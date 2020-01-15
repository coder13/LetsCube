import {
  ROOM_UPDATED,
  ROOM_FETCHING,
  NEW_ATTEMPT,
} from './actions';

const INITIAL_STATE = {
  fetching: null,
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
  [NEW_ATTEMPT]: (state, action) =>
    Object.assign({}, state, {
      attempts: Object.assign(state.attempts, {
        [state.attempts.length - 1]: Object.assign(state.attempts[state.attempts.length - 1], action.attempt)
      })
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