import {
  SEND_CHAT,
  RECEIVE_CHAT,
} from './actions';

const INITIAL_STATE = {
  messages: [],
};

function roomReducer(state = INITIAL_STATE, action) {
  if (action.type === SEND_CHAT || action.type === RECEIVE_CHAT) {
    return {
      ...state,
      messages: state.messages.concat([action.message]),
    };
  }
  return state;
}

export default roomReducer;
