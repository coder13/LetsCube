import { SET_ADMIN_DATA } from './actions';

const INITIAL_STATE = {
  rooms: [],
};

const reducers = {
  [SET_ADMIN_DATA]: (state, { data }) => ({
    ...state,
    rooms: data,
  }),
};

function adminReducer(state = INITIAL_STATE, action) {
  if (reducers[action.type]) {
    return reducers[action.type](state, action);
  }
  return state;
}

export default adminReducer;
