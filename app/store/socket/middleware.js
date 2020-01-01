import Socket from './Socket';
import {
  connectionChanged,
  CONNECT_SOCKET,
  DISCONNECT_SOCKET
} from './actions';
import { roomsUpdated } from '../rooms/actions';

const socketMiddleware = store => {
  // The socket's connection state changed
  const onChange = isConnected => {
    store.dispatch(connectionChanged(isConnected));
  };

  const onUpdateRooms = rooms => {
    store.dispatch(roomsUpdated(rooms));
  };

  const socket = new Socket({
    onChange,
    onUpdateRooms
  });

  const reducers = {
    [CONNECT_SOCKET]: () => {
      socket.connect();
    },
    [DISCONNECT_SOCKET]: () => {
      socket.disconnect();
    }
  };

  // Return the handler that will be called for each action dispatched
  return next => action => {
    if (reducers[action.type]) {
      return reducers[action.type]();
    }
    next(action); // This is a middleware, we still need to call this!
  };
};

export default socketMiddleware;