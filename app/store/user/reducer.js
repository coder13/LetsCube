import {
  USER_CHANGED,
  USER_FETCHING,
  UPDATE_PROFILE,
} from './actions';

const INITIAL_STATE = {
  fetching: true,
  id: undefined,
  name: undefined,
  wcaId: undefined,
  email: undefined,
  avatar: {
    thumb_url: undefined,
  },
};

const reducers = {
  [USER_CHANGED]: (state, action) => ({
    ...state,
    fetching: false,
    ...action.user,
  }),
  [USER_FETCHING]: (state) => ({ ...state, fetching: true }),
  [UPDATE_PROFILE]: (state, action) => ({ ...state, ...action.profile }),
};

// User reducer
function userReducer(state = INITIAL_STATE, action) {
  if (reducers[action.type]) {
    return reducers[action.type](state, action);
  }
  return state;
}

export default userReducer;
