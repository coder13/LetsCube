import {
  CONNECTION_CHANGED,
  CONNECTED,
  DISCONNECTED,
  USER_COUNT_UPDATED,
} from './actions';

const INITIAL_STATE = {
  connected: true,
  connectionStatus: 'connecting',
  userCount: 0,
};

const reducers = {
  /* Namespace events: */
  [CONNECTED]: (state) => ({
    ...state,
    connected: true,
    connectionStatus: 'connected',
  }),
  [DISCONNECTED]: (state) => ({
    ...state,
    connected: false,
    connectionStatus: 'disconnected',
  }),
  [CONNECTION_CHANGED]: (state, action) => ({
    ...state,
    connected: action.connected,
    connectionStatus: action.connected ? 'connected' : 'disconnected',
  }),
  /* Other Events */
  [USER_COUNT_UPDATED]: (state, action) => ({
    ...state,
    userCount: action.userCount,
  }),
};

function socketReducer(state = INITIAL_STATE, action) {
  if (reducers[action.type]) {
    return reducers[action.type](state, action);
  }
  return state;
}

export default socketReducer;
