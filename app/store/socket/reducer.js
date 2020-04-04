import {
  CONNECTION_CHANGED,
  SOCKET_JOIN_ROOM,
  CONNECTED,
  DISCONNECTED,
} from './actions';
import { LEAVE_ROOM } from '../room/actions';

const INITIAL_STATE = {
  connected: false,
  room: null,
};

const reducers = {
  [CONNECTED]: (state) =>
    Object.assign({}, state, {
      connected: true
    }),
  [DISCONNECTED]: (state) =>
    Object.assign({}, state, {
      connected: false
    }),
  [CONNECTION_CHANGED]: (state, action) =>
    Object.assign({}, state, {
      connected: action.connected,
      error: false
    }),
  [SOCKET_JOIN_ROOM]: (state, action) => 
    Object.assign({}, state, {
      room: action.room
    }),
  [LEAVE_ROOM]: (state) =>
    Object.assign({}, state, {
      room: null,
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