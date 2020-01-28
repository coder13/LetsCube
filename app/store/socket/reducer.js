import { CONNECTION_CHANGED, SOCKET_JOIN_ROOM } from './actions';

const INITIAL_STATE = {
  connected: false,
  room: null,
  error: false
};

const reducers = {
  [CONNECTION_CHANGED]: (state, action) =>
    Object.assign({}, state, {
      connected: action.connected,
      error: false
    }),
  [SOCKET_JOIN_ROOM]: (state, action) => 
    Object.assign({}, state, {
      room: action.room
    }),
}

function socketReducer(state = INITIAL_STATE, action) {
  if (reducers[action.type]) {
    return reducers[action.type](state, action)
  } else {
    return state;
  }
}

export default socketReducer;