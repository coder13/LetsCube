import { push } from 'connected-react-router';
import * as Protocol from '../../lib/protocol.js'
import Socket from './Socket';
import {
  connectionChanged,
  CONNECT_SOCKET,
  DISCONNECT_SOCKET,
  roomJoined
} from './actions';
import {
  FETCH_ROOM,
  JOIN_ROOM,
  LEAVE_ROOM,
  SUBMIT_RESULT,
  fetchingRoom,
  roomUpdated,
  userJoined,
  userLeft,
  newAttempt,
  newResult
} from '../room/actions';
import {
  CREATE_ROOM,
  roomCreated,
  roomsUpdated
} from '../rooms/actions';

const socketMiddleware = store => {
  // The socket's connection state changed
  const onChange = isConnected => {
    store.dispatch(connectionChanged(isConnected));
  };

  const onSocketError = error => {
    console.error('[SOCKET.IO]', error);
  };

  const socket = new Socket({
    onChange,
    events: {
      [Protocol.ERROR]: error => {
        console.log(41, error);
        if (error.statusCode === 404) {
          store.dispatch(push('/'));
        }
      },
      [Protocol.UPDATE_ROOMS]: rooms => {
        store.dispatch(roomsUpdated(rooms));
      },
      [Protocol.UPDATE_ROOM]: room => {
        store.dispatch(roomUpdated(room));
      },
      [Protocol.ROOM_CREATED]: room => {
        store.dispatch(roomCreated(room));
      },
      [Protocol.FORCE_JOIN]: room => {
        store.dispatch(roomUpdated(room));
        store.dispatch(push(`/rooms/${room.id}`));
      },
      [Protocol.JOIN]: room => {
        store.dispatch(roomJoined(room.accessCode));
        store.dispatch(roomUpdated(room));
        console.log(38, Protocol.JOIN, room)
      },
      [Protocol.USER_JOIN]: user => {
        store.dispatch(userJoined(user));
      },
      [Protocol.USER_LEFT]: user => {
        store.dispatch(userLeft(user));  
      },
      [Protocol.NEW_ATTEMPT]: attempt => {
        console.log(64, attempt);
        store.dispatch(newAttempt(attempt));
      },
      [Protocol.NEW_RESULT]: result => {
        console.log(75, result);
        store.dispatch(newResult(result));
      }
    },
  });

// catch attempt to join room here and then fetch socket event
  const reducers = {
    [CONNECT_SOCKET]: () => {
      socket.connect();
    },
    [DISCONNECT_SOCKET]: () => {
      socket.disconnect();
    },
    [FETCH_ROOM]: ({id}) => {
      store.dispatch(fetchingRoom());
      console.log(86, id);
      socket.emit(Protocol.FETCH_ROOM, id);
    },
    [JOIN_ROOM]: ({accessCode}) => {
      console.log(56, accessCode)
      socket.emit(Protocol.JOIN_ROOM, accessCode, (room) => {
        console.log(57, room);
      });
    },
    [CREATE_ROOM]: ({room}) => {
      socket.emit(Protocol.CREATE_ROOM, room);
    },
    [LEAVE_ROOM]: () => {
      socket.emit(Protocol.LEAVE_ROOM)
    },
    [SUBMIT_RESULT]: (event) => {
      socket.emit(Protocol.SUBMIT_RESULT, event.result);
    }
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