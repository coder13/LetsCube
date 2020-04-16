import {
  NEW_MESSAGE,
  CLOSE_MESSAGE,
} from './actions';

const INITIAL_STATE = {
  messages: [],
};

const reducers = {
  [NEW_MESSAGE]: (state, action) => ({
    ...state,
    messages: state.messages.concat([action.message]),
  }),
  [CLOSE_MESSAGE]: (state, action) => ({
    ...state,
    messages: state.messages.filter((m, i) => i !== action.index),
  }),
};

function roomReducer(state = INITIAL_STATE, action) {
  if (reducers[action.type]) {
    return reducers[action.type](state, action);
  }
  return state;
}

export default roomReducer;
