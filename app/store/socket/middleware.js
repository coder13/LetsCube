import { push } from 'connected-react-router';
import * as Protocol from '../../lib/protocol.js'
import Socket from './Socket';
import {
  CONNECT_SOCKET,
  DISCONNECT_SOCKET,
  connectionChanged,
  roomJoined,
  connected,
  disconnected,
} from './actions';
import {
  FETCH_ROOM,
  DELETE_ROOM,
  JOIN_ROOM,
  LEAVE_ROOM,
  SUBMIT_RESULT,
  REQUEST_SCRAMBLE,
  fetchingRoom,
  joinRoom,
  roomUpdated,
  leaveRoom,
  userJoined,
  userLeft,
  newAttempt,
  newResult,
  updateAdmin,
} from '../room/actions';
import {
  CREATE_ROOM,
  roomCreated,
  roomDeleted,
  roomsUpdated
} from '../rooms/actions';
import { createMessage } from '../messages/actions';

const socketMiddleware = store => {
  // The socket's connection state changed
  const onChange = isConnected => {
    store.dispatch(connectionChanged(isConnected));
  };

  const socket = new Socket({
    onChange,
    onConnected: () => {
      store.dispatch(connected());
    },
    onDisconnected: () => {
      store.dispatch(disconnected());
    },
    events: {
      [Protocol.RECONNECT]: () => {
        console.log('[SOCKET.IO] reconnected!');
        if (store.getState().room.accessCode) {
          store.dispatch(joinRoom(store.getState().room.accessCode));
        }
      },
      [Protocol.ERROR]: error => {
        console.log('SOCKET.IO', error);
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
      [Protocol.ROOM_DELETED]: room => {
        store.dispatch(roomDeleted(room));
        if (room === store.getState().room.id) {
          store.dispatch(leaveRoom());
        }
      },
      [Protocol.UPDATE_ADMIN]: admin => {
        store.dispatch(updateAdmin(admin));
      },
      [Protocol.FORCE_JOIN]: room => {
        store.dispatch(roomUpdated(room));
        store.dispatch(push(`/rooms/${room.id}`));
      },
      [Protocol.JOIN]: (room) => {
        store.dispatch(roomJoined(room.accessCode));
        store.dispatch(roomUpdated(room));

        store.dispatch(createMessage({
          severity: 'success',
          text: 'room joined'
        }));
      },
      [Protocol.USER_JOIN]: user => {
        store.dispatch(userJoined(user));
      },
      [Protocol.USER_LEFT]: user => {
        store.dispatch(userLeft(user));  
      },
      [Protocol.NEW_ATTEMPT]: attempt => {
        store.dispatch(newAttempt(attempt));
      },
      [Protocol.NEW_RESULT]: result => {
        store.dispatch(newResult(result));
      }
    },
  });

// catch attempt to join room here and then fetch socket event
  const reducers = {
    // no real point in this being here oper other places
    '@@router/LOCATION_CHANGE': ({ payload }) => {
      if (payload.location.pathname === '/') {
        store.dispatch(leaveRoom());
      }
    },
    [CONNECT_SOCKET]: () => {
      socket.connect();
    },
    [DISCONNECT_SOCKET]: () => {
      socket.disconnect();
    },
    [FETCH_ROOM]: ({id}) => {
      store.dispatch(fetchingRoom());
      socket.emit(Protocol.FETCH_ROOM, id);
    },
    [DELETE_ROOM]: ({id}) => {
      socket.emit(Protocol.DELETE_ROOM, id);
    },
    [JOIN_ROOM]: ({accessCode}) => {
      socket.emit(Protocol.JOIN_ROOM, accessCode);
    },
    [CREATE_ROOM]: ({room}) => {
      socket.emit(Protocol.CREATE_ROOM, room);
    },
    [LEAVE_ROOM]: () => {
      socket.emit(Protocol.LEAVE_ROOM);
    },
    [SUBMIT_RESULT]: (event) => {
      socket.emit(Protocol.SUBMIT_RESULT, event.result);
    },
    [REQUEST_SCRAMBLE]: (event) => {
      socket.emit(Protocol.REQUEST_SCRAMBLE, event.result);
    },
  };

  // Return the handler that will be called for each action dispatched
  return next => (action) => {
    if (reducers[action.type]) {
      reducers[action.type](action);
    }
    next(action); // This is a middleware, we still need to call this!
  };
};

export default socketMiddleware;