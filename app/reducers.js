import {
  USER_CHANGED,
  SOCKET_CONNECTED,
  SOCKET_DISCONNECTED
} from './actions.js';

const INITIAL_STATE = {
  connected: false,
  user: {}
}

const reducers = {
  [USER_CHANGED]: (state, action) => {
    return Object.assign({}, state, {
      user: action.user
    });
  },
  [SOCKET_CONNECTED]: (state, action) =>
    Object.assign({}, state, {
      connected: true
    }),
  [SOCKET_DISCONNECTED]: (state, action) =>
    Object.assign({}, state, {
      connected: false
    }),
}

function rootReducer (state = INITIAL_STATE, action) {
  console.log(29, action)
  return reducers[action.type] ? reducers[action.type](action) : INITIAL_STATE;
}

export default rootReducer;