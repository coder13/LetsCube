import { CONNECTION_CHANGED } from './actions';

const INITIAL_STATE = {
  connected: false,
  error: false
};

const reducers = {
  [CONNECTION_CHANGED]: (state, action) =>
    Object.assign({}, state, {
      connected: action.connected,
      error: false
    })
}

function socketReducer(state = INITIAL_STATE, action) {
  if (reducers[action.type]) {
    return reducers[action.type](state, action)
  } else {
    return state;
  }
}

export default socketReducer;