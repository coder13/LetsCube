import {
  ROOMS_UPDATED,
  ROOM_CREATED,
  ROOM_DELETED,
  ROOM_UPDATED,
} from './actions';

const INITIAL_STATE = {
  rooms: [],
};

const reducers = {
  [ROOMS_UPDATED]: (state, action) => ({
    ...state,
    fetching: false,
    rooms: action.rooms,
  }),
  [ROOM_CREATED]: (state, action) => ({
    ...state,
    rooms: [...state.rooms, action.room],
  }),
  [ROOM_DELETED]: (state, action) => ({
    ...state,
    rooms: state.rooms.filter((room) => room._id !== action.room),
  }),
  [ROOM_UPDATED]: (state, action) => ({
    rooms: state.rooms.map((i) => (i._id === action.room._id ? action.room : i)),
  }),
};

// Socket reducer
function roomsReducer(state = INITIAL_STATE, action) {
  if (reducers[action.type]) {
    return reducers[action.type](state, action);
  }
  return state;
}

export default roomsReducer;
