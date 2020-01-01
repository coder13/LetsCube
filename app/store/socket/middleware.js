import * as Protocol from '../../lib/protocol.js'
import Socket from './Socket';
import {
  connectionChanged,
  CONNECT_SOCKET,
  DISCONNECT_SOCKET
} from './actions';
import { FETCH_ROOM, roomUpdated } from '../room/actions';
import { roomsUpdated } from '../rooms/actions';

const socketMiddleware = store => {
  // The socket's connection state changed
  const onChange = isConnected => {
    store.dispatch(connectionChanged(isConnected));
  };

  const onUpdateRooms = rooms => {
    store.dispatch(roomsUpdated(rooms));
  };

  const onUpdateRoom = room => {
    store.dispatch(roomUpdated(room));
  };

  const onSocketError = (error) => {
    console.log(20, 'socket erorr', error)
  }

  const socket = new Socket({
    onChange,
    onSocketError,
    onUpdateRooms,
    onUpdateRoom,
  });

  const reducers = {
    [CONNECT_SOCKET]: () => {
      socket.connect();
    },
    [DISCONNECT_SOCKET]: () => {
      socket.disconnect();
    },
    [FETCH_ROOM]: ({id}) => {
      socket.emit(Protocol.FETCH_ROOM, id)
    },
  };

  // Return the handler that will be called for each action dispatched
  return next => action => {
    if (reducers[action.type]) {
      return reducers[action.type](action);
    }
    next(action); // This is a middleware, we still need to call this!
  };
};

export default socketMiddleware;