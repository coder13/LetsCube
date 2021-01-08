import {
  CONNECTION_CHANGED,
  SOCKET_JOIN_ROOM,
  CONNECTED,
  DISCONNECTED,
  LOGIN_FAILED,
} from './actions';
import { LEAVE_ROOM } from '../room/actions';

const INITIAL_STATE = {
  connected: false,
  room: null,
  loginFailed: null,
  URI: null,
};

const reducers = {
  [CONNECTED]: (state, action) => ({ ...state, connected: true, URI: action.URI }),
  [DISCONNECTED]: (state) => ({ ...state, connected: false, URI: null }),
  [CONNECTION_CHANGED]: (state, action) => ({
    ...state,
    connected: action.connected,
    error: false,
  }),
  [SOCKET_JOIN_ROOM]: (state, action) => ({ ...state, room: action.room }),
  [LEAVE_ROOM]: (state) => ({ ...state, room: null }),
  [LOGIN_FAILED]: (state, action) => ({ ...state, loginFailed: action.error }),
};

function socketReducer(state = INITIAL_STATE, action) {
  if (reducers[action.type]) {
    return reducers[action.type](state, action);
  }
  return state;
}

export default socketReducer;
