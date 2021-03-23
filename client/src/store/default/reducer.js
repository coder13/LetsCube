import {
  CONNECTION_CHANGED,
  CONNECTED,
  DISCONNECTED,
  USER_COUNT_UPDATED,
} from './actions';

const INITIAL_STATE = {
  connected: false,
  URI: null,
  userCount: 0,
};

const reducers = {
  [CONNECTED]: (state, action) => ({ ...state, connected: true, URI: action.URI }),
  [DISCONNECTED]: (state) => ({ ...state, connected: false, URI: null }),
  [CONNECTION_CHANGED]: (state, action) => ({
    ...state,
    connected: action.connected,
    error: false,
  }),
  [USER_COUNT_UPDATED]: (state, action) => ({ ...state, userCount: action.userCount }),
};

function socketReducer(state = INITIAL_STATE, action) {
  if (reducers[action.type]) {
    return reducers[action.type](state, action);
  }
  return state;
}

export default socketReducer;
