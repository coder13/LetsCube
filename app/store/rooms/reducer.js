import {
  ROOMS_UPDATED,
  ROOMS_FETCHING,
  ROOM_CREATED,
  ROOM_DELETED,
} from './actions';

const INITIAL_STATE = {
  fetching: null,
  rooms: []
};

const reducers = {
  [ROOMS_UPDATED]: (state, action) => {
    return Object.assign({}, state, {
      fetching: false,
      rooms: action.rooms
    })
  },    
  [ROOMS_FETCHING]: (state, action) =>
    Object.assign({}, state, {
      fetching: true
    }),
  [ROOM_CREATED]: (state, action) =>
    Object.assign({}, state, {
      rooms: [...state.rooms, action.room]
    }),
  [ROOM_DELETED]: (state, action) =>
    Object.assign({}, state, {
      rooms: state.rooms.filter(room => room.id !== action.room),
    }),
}

// Socket reducer
function roomsReducer(state = INITIAL_STATE, action) {
  if (reducers[action.type]) {
    return reducers[action.type](state, action)
  } else {
    return state;
  }
}

export default roomsReducer;