import { push } from 'connected-react-router';
import { v4 as uuid } from 'uuid';
import UIfx from 'uifx';
import notificationAsset from '../../assets/notification.mp3';
import * as Protocol from '../../lib/protocol';
import Namespace from '../../lib/Namespace';
import {
  DELETE_ROOM,
  JOIN_ROOM,
  LEAVE_ROOM,
  SUBMIT_RESULT,
  SEND_EDIT_RESULT,
  REQUEST_SCRAMBLE,
  CHANGE_EVENT,
  SEND_STATUS,
  UPDATE_COMPETING,
  EDIT_ROOM,
  KICK_USER,
  UPDATE_USER_BANNED,
  UPDATE_REGISTRATION,
  START_ROOM,
  PAUSE_ROOM,
  UPDATE_USER,
  joinRoom,
  // leaveRoom,
  roomUpdated,
  resetRoom,
  userJoined,
  userLeft,
  newAttempt,
  newResult,
  editResult,
  receiveStatus,
  updateAdmin,
  updateCompetingForUser,
  nextSolveAt,
} from '../room/actions';
import {
  ROOMS_CONNECT,
  ROOMS_DISCONNECT,
  CREATE_ROOM,
  connected,
  disconnected,
  connectionChanged,
  roomCreated,
  roomUpdated as globalRoomUpdated,
  roomDeleted,
  roomsUpdated,
  updateUsers,
} from '../rooms/actions';
import { createMessage } from '../messages/actions';
import { SEND_CHAT, receiveChat } from '../chat/actions';
import { USER_CHANGED } from '../user/actions';
import {
  FETCH_ADMIN_DATA,
  setAdminData,
} from '../admin/actions';
import { manager } from './manager';

const roomsNamespaceMiddleware = (store) => {
  const reconnectToRoom = () => {
    if (store.getState().room.accessCode) {
      store.dispatch(joinRoom({
        id: store.getState().room._id,
        password: store.getState().room.password,
      }));
    }
  };

  const namespace = new Namespace({
    manager,
    namespace: '/rooms',
    onChange: (isConnected) => {
      store.dispatch(connectionChanged(isConnected));
    },
    onConnected: () => {
      store.dispatch(connected());
      reconnectToRoom();
    },
    onDisconnected: () => {
      store.dispatch(disconnected());
    },
    events: {
      [Protocol.ERROR]: (error) => {
        // eslint-disable-next-line no-console
        console.error(error);
        store.dispatch(createMessage({
          severity: 'error',
          text: error.message,
        }));
      },
      [Protocol.UPDATE_ROOMS]: (rooms) => {
        store.dispatch(roomsUpdated(rooms));
      },
      [Protocol.UPDATE_ROOM]: (room) => {
        store.dispatch(roomUpdated(room));
      },
      [Protocol.GLOBAL_ROOM_UPDATED]: (room) => {
        store.dispatch(globalRoomUpdated(room));
      },
      [Protocol.ROOM_CREATED]: (room) => {
        store.dispatch(roomCreated(room));
      },
      [Protocol.ROOM_DELETED]: (room) => {
        store.dispatch(roomDeleted(room));
        if (room === store.getState().room._id) {
          store.dispatch(push('/'));
          store.dispatch(resetRoom());
        }
      },
      [Protocol.UPDATE_ADMIN]: (admin) => {
        store.dispatch(updateAdmin(admin));

        const adminName = admin.id === store.getState().user.id ? 'You are' : `${admin.displayName} is`;
        store.dispatch(receiveChat({
          id: uuid(),
          userId: -1,
          text: `${adminName} in control now.`,
          icon: 'ADMIN',
        }));
      },
      [Protocol.FORCE_JOIN]: (room) => {
        store.dispatch(push(`/rooms/${room._id}`));
      },
      [Protocol.KICKED]: () => {
        store.dispatch(push('/'));
        store.dispatch(resetRoom());
      },
      [Protocol.BANNED]: () => {
        store.dispatch(push('/'));
        store.dispatch(resetRoom());
      },
      [Protocol.USER_JOIN]: (user) => {
        store.dispatch(userJoined(user));

        store.dispatch(receiveChat({
          id: uuid(),
          userId: -1,
          text: `${user.displayName} Joined`,
          icon: 'USER',
        }));
      },
      [Protocol.USER_LEFT]: (user) => {
        store.dispatch(receiveChat({
          id: uuid(),
          userId: -1,
          text: `${store.getState().room.users.find((u) => u.id === user).displayName} Left`,
          icon: 'USER',
        }));

        store.dispatch(userLeft(user));
      },
      [Protocol.NEW_ATTEMPT]: ({ attempt, waitingFor }) => {
        store.dispatch(newAttempt(attempt, waitingFor));

        store.dispatch(receiveChat({
          id: uuid(),
          userId: -1,
          text: 'A new scramble is here',
          secondary: attempt.scrambles.join(', '),
          icon: 'SCRAMBLE',
          event: store.getState().room.event,
        }));

        if (!store.getState().user.muteTimer) {
          const notification = new UIfx(
            notificationAsset,
            { volume: 0.2 },
          );
          notification.play();
        }
      },
      [Protocol.NEW_RESULT]: (result) => {
        store.dispatch(newResult(result));
      },
      [Protocol.EDIT_RESULT]: (result) => {
        store.dispatch(editResult(result));
        // calculate grand prix points
      },
      [Protocol.MESSAGE]: (message) => {
        store.dispatch(receiveChat(message));
      },
      [Protocol.UPDATE_STATUS]: ({ user, status }) => {
        store.dispatch(receiveStatus(user, status));
      },
      [Protocol.UPDATE_COMPETING]: ({ userId, competing }) => {
        store.dispatch(updateCompetingForUser(userId, competing));

        const displayName = userId === store.getState().user.id ? 'You are' : `${store.getState().room.users.find((user) => user.id === userId).displayName} is`;
        store.dispatch(receiveChat({
          id: uuid(),
          userId: -1,
          text: `${displayName} ${competing ? 'competing' : 'skipping'}`,
          icon: 'USER',
        }));
      },
      [Protocol.NEXT_SOLVE_AT]: (dateTime) => {
        store.dispatch(nextSolveAt(dateTime));
      },
      [Protocol.UPDATE_USERS_IN_LOBBY]: ({ users }) => {
        store.dispatch(updateUsers(users));
      },
    },
  });

  // catch attempt to join room here and then fetch socket event
  const reducers = {
    [ROOMS_CONNECT]: () => {
      namespace.connect();
    },
    [ROOMS_DISCONNECT]: () => {
      namespace.disconnect();
    },
    // no real point in this being here oper other places
    '@@router/LOCATION_CHANGE': ({ payload }) => {
      // TODO: improve
      if (payload.location.pathname === '/' || payload.location.pathname === '/profile') {
        document.title = 'Let\'s Cube';
      }
    },
    [USER_CHANGED]: () => {
      // TODO: improve
      manager.disconnect();
      manager.connect();
    },
    [DELETE_ROOM]: ({ id }) => {
      namespace.emit(Protocol.DELETE_ROOM, id, (err) => {
        if (err) {
          store.dispatch(createMessage({
            severity: 'error',
            text: err.message,
          }));
        }
      });
    },
    [JOIN_ROOM]: ({ id, password }) => {
      namespace.emit(Protocol.JOIN_ROOM, { id, password }, (err, room) => {
        if (err) {
          if (err.banned) {
            store.dispatch(push('/'));
          }

          store.dispatch(createMessage({
            severity: 'error',
            text: err.message,
          }));
        }

        if (room) {
          store.dispatch(roomUpdated(room));

          if (room.accessCode) {
            store.dispatch(createMessage({
              severity: 'success',
              text: 'room joined',
            }));
          }
        }
      });
    },
    [CREATE_ROOM]: ({ options }) => {
      namespace.emit(Protocol.CREATE_ROOM, options, (err, room) => {
        if (err) {
          store.dispatch(createMessage({
            severity: 'error',
            text: err.message,
          }));
          return;
        }

        // store.dispatch(roomJoined(room.accessCode));
        store.dispatch(roomUpdated(room));
        store.dispatch(push(`/rooms/${room._id}`));
      });
    },
    [LEAVE_ROOM]: () => {
      if (store.getState().room._id) {
        namespace.emit(Protocol.LEAVE_ROOM);
      }
    },
    [SUBMIT_RESULT]: (event) => {
      namespace.emit(Protocol.SUBMIT_RESULT, event.result);
    },
    [SEND_EDIT_RESULT]: (event) => {
      namespace.emit(Protocol.SEND_EDIT_RESULT, event.result);
    },
    [REQUEST_SCRAMBLE]: (event) => {
      namespace.emit(Protocol.REQUEST_SCRAMBLE, event.result);
    },
    [CHANGE_EVENT]: ({ event }) => {
      namespace.emit(Protocol.CHANGE_EVENT, event);
    },
    [EDIT_ROOM]: ({ options }) => {
      namespace.emit(Protocol.EDIT_ROOM, options);
    },
    [SEND_CHAT]: ({ message }) => {
      namespace.emit(Protocol.MESSAGE, message);
    },
    [SEND_STATUS]: ({ status }) => {
      namespace.emit(Protocol.UPDATE_STATUS, {
        user: store.getState().user.id,
        status,
      });
    },
    [UPDATE_COMPETING]: ({ competing }) => {
      namespace.emit(Protocol.UPDATE_COMPETING, competing);
    },
    [KICK_USER]: ({ userId }) => {
      namespace.emit(Protocol.KICK_USER, userId);
    },
    [UPDATE_USER_BANNED]: ({ userId, banned }) => {
      if (banned) {
        namespace.emit(Protocol.BAN_USER, userId);
      } else {
        namespace.emit(Protocol.UNBAN_USER, userId);
      }
    },
    [UPDATE_REGISTRATION]: ({ registration }) => {
      namespace.emit(Protocol.UPDATE_REGISTRATION, registration);
    },
    [UPDATE_USER]: ({ userId, competing, registered }) => {
      namespace.emit(Protocol.UPDATE_USER, { userId, competing, registered });
    },
    [START_ROOM]: () => {
      namespace.emit(Protocol.START_ROOM);
    },
    [PAUSE_ROOM]: () => {
      namespace.emit(Protocol.PAUSE_ROOM);
    },
    [FETCH_ADMIN_DATA]: () => {
      namespace.emit(Protocol.ADMIN, (data) => {
        store.dispatch(setAdminData(data));
      });
    },
  };

  // Return the handler that will be called for each action dispatched
  return (next) => (action) => {
    if (reducers[action.type]) {
      reducers[action.type](action);
    }
    next(action); // This is a middleware, we still need to call this!
  };
};

export default roomsNamespaceMiddleware;
