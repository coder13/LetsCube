import {
  ROOM_UPDATED,
  ROOM_FETCHING,
  ROOM_CREATED,
  ROOM_DESTROYED
} from './actions';

const INITIAL_STATE = {
  fetching: null,
  name: null,
  accessCode: null,
  password: null,
  private: null,
  users: [],
};

const reducers = {
  [ROOM_UPDATED]: (state, action) => {
    return Object.assign({}, state, {
      fetching: false,
      ...action.room
    })
  },    
  [ROOM_FETCHING]: (state, action) =>
    Object.assign({}, state, {
      fetching: true
    }),
}

// Socket reducer
function roomReducer(state = INITIAL_STATE, action) {
  if (reducers[action.type]) {
    return reducers[action.type](state, action)
  } else {
    return state;
  }
}

export default roomReducer;