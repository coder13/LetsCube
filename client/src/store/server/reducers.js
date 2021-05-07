import {
  USER_COUNT_UPDATED,
  UPDATE_CONNECTING,
  UPDATE_CONNECTED,
  UPDATE_RECONNECT_ATTEMPTS,
  UPDATE_RECONNECTION_ERROR,
  UPDATE_RECONNECTING,
} from './actions';

const INITIAL_STATE = {
  userCount: 0,
  reconnectAttempts: 0,
  reconnecting: false,
  reconnectError: null,
};

const reducers = {
  [USER_COUNT_UPDATED]: (state, action) => ({
    ...state,
    userCount: action.userCount,
  }),
  [UPDATE_CONNECTING]: (state, action) => ({
    ...state,
    connecting: action.connecting,
  }),
  [UPDATE_CONNECTED]: (state, action) => ({
    ...state,
    connected: action.connected,
  }),
  [UPDATE_RECONNECT_ATTEMPTS]: (state, action) => ({
    ...state,
    reconnectAttempts: action.reconnectAttempts,
    reconnecting: true,
  }),
  [UPDATE_RECONNECTION_ERROR]: (state, action) => ({
    ...state,
    reconnectError: action.reconnectError,
    reconnecting: true,
  }),
  [UPDATE_RECONNECTING]: (state, action) => ({
    ...state,
    reconnecting: action.reconnecting,
  }),
};

function serverReducer(state = INITIAL_STATE, action) {
  if (reducers[action.type]) {
    return reducers[action.type](state, action);
  }
  return state;
}

export default serverReducer;
