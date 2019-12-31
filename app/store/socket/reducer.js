// ACTIONS
import { CONNECTION_CHANGED, PORT_CHANGED } from './actions';

// Initial state
const INITIAL_STATE = {
    connected: false
};

// Socket reducer
function socketReducer(state=INITIAL_STATE, action) {
  let reduced;
  switch (action.type) {
    case CONNECTION_CHANGED:
      reduced = Object.assign({}, state, {
        connected: action.connected,
        isError: false
      });
      break;
    case PORT_CHANGED:
      reduced = Object.assign({}, state, {
        port: action.port
      });
      break;
    default:
      reduced = state;
  }
  return reduced;
}

export default socketReducer;