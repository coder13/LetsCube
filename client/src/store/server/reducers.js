import { USER_COUNT_UPDATED } from './actions';

const INITIAL_STATE = {
  userCount: 0,
};

const reducers = {
  [USER_COUNT_UPDATED]: (state, action) => ({ ...state, userCount: action.userCount }),
};

function serverReducer(state = INITIAL_STATE, action) {
  if (reducers[action.type]) {
    return reducers[action.type](state, action);
  }
  return state;
}

export default serverReducer;
