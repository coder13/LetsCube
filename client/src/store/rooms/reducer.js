import {
  ROOMS_CONNECTED,
  ROOMS_DISCONNECTED,
  ROOMS_CONNECTION_CHANGED,
  ROOMS_UPDATED,
  ROOM_CREATED,
  ROOM_DELETED,
  ROOM_UPDATED,
} from './actions';

const INITIAL_STATE = {
  rooms: [],
  connected: false,
  connectionStatus: 'connecting',
};

const reducers = {
  /* Namespace events: */
  [ROOMS_CONNECTED]: (state) => ({
    ...state,
    connected: true,
    connectionStatus: 'connected',
  }),
  [ROOMS_DISCONNECTED]: (state) => ({
    ...state,
    connected: false,
    connectionStatus: 'disconnected',
  }),
  [ROOMS_CONNECTION_CHANGED]: (state, action) => ({
    ...state,
    connected: action.connected,
    connectionStatus: action.connected ? 'connected' : 'disconnected',
  }),

  /* Other Events */
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
    ...state,
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
