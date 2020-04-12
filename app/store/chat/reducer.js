import { RECEIVE_CHAT } from './actions';
import {
  USER_JOIN,
  ROOM_UPDATED,
  LEAVE_ROOM,
} from '../room/actions';

const INITIAL_STATE = {
  messages: [],
  users: [],
};

const reducers = {
  [RECEIVE_CHAT]: (state, action) => ({
    ...state,
    messages: state.messages.concat([action.message]),
  }),
  [ROOM_UPDATED]: (state, { room: { users = [] } }) => ({
    ...state,
    // update the list of users but don't add duplicates
    users: users.concat(state.users
      .filter((u) => users.findIndex((i) => i.id === u.id) > -1)),
  }),
  [LEAVE_ROOM]: () => ({
    messages: [],
    users: [],
  }),
  [USER_JOIN]: (state, action) => ({
    ...state,
    users: state.users.concat(action.user),
  }),
};

function roomReducer(state = INITIAL_STATE, action) {
  if (reducers[action.type]) {
    return reducers[action.type](state, action);
  }
  return state;
}

export default roomReducer;
