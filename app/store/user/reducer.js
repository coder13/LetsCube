import {
  USER_CHANGED,
  USER_FETCHING
} from './actions';

const INITIAL_STATE = {
  fetching: true,
  _id: undefined,
  name: undefined,
  wca_id: undefined,
  email: undefined
};

const reducers = {
  [USER_CHANGED]: (state, action) =>
    Object.assign({}, state, {
      fetching: false,
      ...action.user
    }),
  [USER_FETCHING]: (state, action) =>
    Object.assign({}, state, {
      fetching: true
    })
}

// User reducer
function userReducer(state = INITIAL_STATE, action) {
  if (reducers[action.type]) {
    return reducers[action.type](state, action)
  } else {
    return state;
  }
}

export default userReducer;