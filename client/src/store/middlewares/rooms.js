import history from '../../lib/history';
import UIfx from 'uifx';
import notificationAsset from '../../assets/notification.mp3';
import Protocol from '../../lib/protocol';
import Namespace from '../../lib/Namespace';
import { uuid } from '../../lib/utils';
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
  DISCARD_PENDING_RESULT,
  joinRoom,
  roomJoinFailed,
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
  resultSubmissionPending,
  resultSubmissionSending,
  resultSubmissionFailed,
  resultSubmissionCleared,
} from '../room/actions';
import {
  canDiscardPendingResult,
  clearPendingResult,
  createPendingResult,
  markPendingResultAttempted,
  markPendingResultFailed,
  pendingResultMatches,
  persistPendingResult,
  readPendingResult,
} from '../room/resultOutbox';
import {
  clearRoomPassword,
  persistRoomPassword,
  purgeLegacyRoomPasswords,
  readRoomPassword,
} from '../room/roomPasswordStorage';
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

const DEFAULT_ACK_TIMEOUT_MS = 10000;
const DEFAULT_RETRY_DELAY_MS = 2000;

export const createRoomsNamespaceMiddleware = ({
  NamespaceClass = Namespace,
  namespaceManager = manager,
  storage = window.localStorage,
  createSubmissionId = uuid,
  now = Date.now,
  setTimeoutFn = window.setTimeout.bind(window),
  clearTimeoutFn = window.clearTimeout.bind(window),
  ackTimeoutMs = DEFAULT_ACK_TIMEOUT_MS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
} = {}) => (store) => {
  try {
    purgeLegacyRoomPasswords(storage);
  } catch {
    // Passwords are intentionally kept in memory only.
  }
  let roomsConnected = false;
  let joinedRoomId = null;
  let pendingJoinRequest = null;
  let joinGeneration = 0;
  let submissionGeneration = 0;
  let submissionAckTimer = null;
  let submissionRetryTimer = null;
  let hydratedPendingResult = false;
  let storageWarningSubmissionId = null;
  let passwordStorageWarningRoomId = null;

  const currentSubmission = () => store.getState().room.resultSubmission;
  const readStoredPendingResult = () => {
    try {
      return readPendingResult(storage);
    } catch {
      return null;
    }
  };

  const readStoredRoomPassword = (roomId) => {
    try {
      return readRoomPassword(roomId);
    } catch {
      return null;
    }
  };

  const forgetRoomPassword = (roomId) => {
    try {
      clearRoomPassword(roomId);
    } catch {
      // The next invalid join will try again.
    }
  };

  const warnPasswordStorage = (roomId) => {
    if (passwordStorageWarningRoomId === String(roomId)) {
      return;
    }

    passwordStorageWarningRoomId = String(roomId);
    store.dispatch(createMessage({
      severity: 'warning',
      text: 'Room password storage is unavailable on this device.',
    }));
  };

  const rememberRoomPassword = (roomId, password) => {
    if (!password) {
      return;
    }

    try {
      persistRoomPassword(roomId, password);
    } catch {
      warnPasswordStorage(roomId);
    }
  };

  const applySuccessfulRoomEdit = (room, options) => {
    const updatedRoom = room || store.getState().room;
    const roomId = updatedRoom._id || store.getState().room._id;
    if (options.private === false || updatedRoom.private === false) {
      forgetRoomPassword(roomId);
      store.dispatch(roomUpdated({
        ...updatedRoom,
        password: null,
      }));
      return;
    }

    if (options.password) {
      rememberRoomPassword(roomId, options.password);
      store.dispatch(roomUpdated({
        ...updatedRoom,
        password: options.password,
      }));
      return;
    }

    store.dispatch(roomUpdated({
      ...updatedRoom,
      password: store.getState().room.password || readStoredRoomPassword(roomId),
    }));
  };

  const warnPendingResultNotBackedUp = (submissionId) => {
    if (storageWarningSubmissionId === submissionId) {
      return;
    }

    storageWarningSubmissionId = submissionId;
    store.dispatch(createMessage({
      severity: 'warning',
      text: 'This result could not be backed up on this device. Keep this tab open while it submits.',
    }));
  };

  const clearSubmissionTimers = () => {
    if (submissionAckTimer !== null) {
      clearTimeoutFn(submissionAckTimer);
      submissionAckTimer = null;
    }
    if (submissionRetryTimer !== null) {
      clearTimeoutFn(submissionRetryTimer);
      submissionRetryTimer = null;
    }
  };

  const invalidateSubmissionAttempt = () => {
    submissionGeneration += 1;
    clearSubmissionTimers();
  };

  const normalizeSubmissionError = (error, fallbackMessage) => ({
    statusCode: error && error.statusCode,
    message: (error && error.message) || fallbackMessage,
    retryable: !!(error && error.retryable),
  });

  const normalizeResultForComparison = (result = {}) => ({
    time: result.time,
    AUF: !!(result.penalties && result.penalties.AUF),
    DNF: !!(result.penalties && result.penalties.DNF),
    inspection: !!(result.penalties && result.penalties.inspection),
  });

  const resultEchoMatches = (echo, pendingResult) => {
    const { room, user } = store.getState();
    const echoedSubmissionId = echo.result && echo.result.submissionId;
    const pendingValue = normalizeResultForComparison(pendingResult.result);
    const echoedValue = normalizeResultForComparison(echo.result);

    return pendingResultMatches(pendingResult, { userId: user.id, roomId: room._id })
      && String(joinedRoomId) === String(room._id)
      && String(echo.userId) === String(user.id)
      && String(echo.id) === String(pendingResult.attemptId)
      && echoedSubmissionId === undefined
      && pendingValue.time === echoedValue.time
      && pendingValue.AUF === echoedValue.AUF
      && pendingValue.DNF === echoedValue.DNF
      && pendingValue.inspection === echoedValue.inspection;
  };

  let flushPendingResult;

  const completePendingResult = (pendingResult) => {
    const submission = currentSubmission();
    if (!submission.pendingResult
      || submission.pendingResult.submissionId !== pendingResult.submissionId) {
      return false;
    }

    invalidateSubmissionAttempt();
    try {
      const cleared = clearPendingResult(pendingResult.submissionId, storage);
      if (!cleared) {
        const storedPendingResult = readStoredPendingResult();
        if (storedPendingResult) {
          store.dispatch(resultSubmissionPending(storedPendingResult));
          flushPendingResult();
          return false;
        }
      }
    } catch {
      store.dispatch(createMessage({
        severity: 'warning',
        text: 'Your result was saved, but its local backup could not be removed.',
      }));
    }
    store.dispatch(resultSubmissionCleared(pendingResult.submissionId));
    return true;
  };

  let namespace;

  flushPendingResult = () => {
    const submission = currentSubmission();
    let pendingResult = submission && submission.pendingResult;
    const { room, user } = store.getState();

    if (!pendingResult
      || submission.status === 'sending'
      || submission.status === 'failed'
      || !roomsConnected
      || String(joinedRoomId) !== String(room._id)
      || !pendingResultMatches(pendingResult, { userId: user.id, roomId: room._id })) {
      return;
    }

    if (submissionRetryTimer !== null) {
      clearTimeoutFn(submissionRetryTimer);
      submissionRetryTimer = null;
    }

    if (pendingResult.deliveryAttempted !== true) {
      pendingResult = markPendingResultAttempted(pendingResult);
      store.dispatch(resultSubmissionPending(pendingResult));
      try {
        persistPendingResult(pendingResult, storage);
      } catch {
        warnPendingResultNotBackedUp(pendingResult.submissionId);
      }
    }

    const generation = submissionGeneration + 1;
    submissionGeneration = generation;
    store.dispatch(resultSubmissionSending(pendingResult.submissionId));

    const retrySubmission = () => {
      if (generation !== submissionGeneration) {
        return;
      }

      invalidateSubmissionAttempt();
      store.dispatch(resultSubmissionPending(pendingResult));
      submissionRetryTimer = setTimeoutFn(() => {
        submissionRetryTimer = null;
        flushPendingResult();
      }, retryDelayMs);
    };

    submissionAckTimer = setTimeoutFn(() => {
      submissionAckTimer = null;
      retrySubmission();
    }, ackTimeoutMs);

    namespace.emit(Protocol.SUBMIT_RESULT, {
      id: pendingResult.attemptId,
      attemptKey: pendingResult.attemptKey,
      result: pendingResult.result,
      submissionId: pendingResult.submissionId,
    }, (error, receipt) => {
      if (generation !== submissionGeneration) {
        return;
      }

      if (submissionAckTimer !== null) {
        clearTimeoutFn(submissionAckTimer);
        submissionAckTimer = null;
      }

      if (error) {
        if (error.retryable) {
          retrySubmission();
          return;
        }

        invalidateSubmissionAttempt();
        const submissionError = normalizeSubmissionError(
          error,
          'The server rejected this result.',
        );
        pendingResult = markPendingResultFailed(pendingResult, submissionError);
        try {
          persistPendingResult(pendingResult, storage);
        } catch {
          warnPendingResultNotBackedUp(pendingResult.submissionId);
        }
        store.dispatch(resultSubmissionPending(pendingResult));
        store.dispatch(resultSubmissionFailed(pendingResult.submissionId, submissionError));
        return;
      }

      const accepted = receipt
        && receipt.submissionId === pendingResult.submissionId
        && (receipt.status === 'saved' || receipt.status === 'duplicate');

      if (!accepted) {
        retrySubmission();
        return;
      }

      completePendingResult(pendingResult);
    });
  };

  const reconnectToRoom = () => {
    const { room } = store.getState();
    const request = pendingJoinRequest || (room.accessCode ? {
      id: room._id,
    } : null);

    if (request) {
      store.dispatch(joinRoom({
        ...request,
        reconnecting: true,
      }));
    }
  };

  const handleDisconnected = () => {
    roomsConnected = false;
    joinedRoomId = null;
    joinGeneration += 1;

    const submission = currentSubmission();
    const pendingResult = submission && submission.pendingResult;
    invalidateSubmissionAttempt();
    if (pendingResult && submission.status === 'sending') {
      store.dispatch(resultSubmissionPending(pendingResult));
    }

    store.dispatch(disconnected());
  };

  namespace = new NamespaceClass({
    manager: namespaceManager,
    namespace: '/rooms',
    onChange: (isConnected) => {
      store.dispatch(connectionChanged(isConnected));
    },
    onConnected: () => {
      roomsConnected = true;
      joinedRoomId = null;
      store.dispatch(connected());
      reconnectToRoom();
    },
    onDisconnected: handleDisconnected,
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
        if (room.private === false) {
          forgetRoomPassword(room._id);
          store.dispatch(roomUpdated({
            ...room,
            password: null,
          }));
          return;
        }

        store.dispatch(roomUpdated(room));
      },
      [Protocol.GLOBAL_ROOM_UPDATED]: (room) => {
        store.dispatch(globalRoomUpdated(room));
      },
      [Protocol.ROOM_CREATED]: (room) => {
        store.dispatch(roomCreated(room));
      },
      [Protocol.ROOM_DELETED]: (room) => {
        forgetRoomPassword(room);
        store.dispatch(roomDeleted(room));
        if (room === store.getState().room._id) {
          history.push('/');
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
        history.push(`/rooms/${room._id}`);
      },
      [Protocol.KICKED]: () => {
        history.push('/');
        store.dispatch(resetRoom());
      },
      [Protocol.BANNED]: () => {
        history.push('/');
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
        const submission = currentSubmission();
        if (submission.pendingResult
          && resultEchoMatches(result, submission.pendingResult)) {
          completePendingResult(submission.pendingResult);
        }
        store.dispatch(newResult(result));
      },
      [Protocol.EDIT_RESULT]: (result) => {
        store.dispatch(editResult(result));
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

  const reducers = {
    [ROOMS_CONNECT]: () => {
      namespace.connect();
    },
    [ROOMS_DISCONNECT]: () => {
      namespace.disconnect();
    },
    '@@router/LOCATION_CHANGE': ({ payload }) => {
      if (payload.location.pathname === '/' || payload.location.pathname === '/profile') {
        document.title = 'Let\'s Cube';
      }
    },
    [USER_CHANGED]: () => {
      namespaceManager.disconnect();
      namespaceManager.connect();
    },
    [DELETE_ROOM]: ({ id }) => {
      namespace.emit(Protocol.DELETE_ROOM, id, (err) => {
        if (err) {
          store.dispatch(createMessage({
            severity: 'error',
            text: err.message,
          }));
          return;
        }

        forgetRoomPassword(id);
      });
    },
    [JOIN_ROOM]: ({ id, password }) => {
      const storedPassword = readStoredRoomPassword(id);
      const roomPassword = password || storedPassword;
      const generation = joinGeneration + 1;
      joinGeneration = generation;
      joinedRoomId = null;
      pendingJoinRequest = { id, password };

      if (!roomsConnected) {
        return;
      }

      namespace.emit(Protocol.JOIN_ROOM, { id, password: roomPassword }, (err, room) => {
        if (generation !== joinGeneration) {
          return;
        }

        pendingJoinRequest = null;

        if (err) {
          if (err.reason === 'not_found' || err.statusCode === 404) {
            forgetRoomPassword(id);
          }

          const invalidPassword = err.reason === 'invalid_password'
            || /invalid password/i.test(err.message || '');
          if (invalidPassword && storedPassword === roomPassword) {
            forgetRoomPassword(id);
          }

          const passwordAccessError = err.reason === 'password_required'
            || err.reason === 'invalid_password'
            || (room && room.private && err.statusCode === 403
              && /password/i.test(err.message || ''));
          if (room && passwordAccessError) {
            store.dispatch(roomUpdated(room));
          }

          if (err.banned) {
            history.push('/');
          }

          store.dispatch(roomJoinFailed(err));
          store.dispatch(createMessage({
            severity: 'error',
            text: err.message,
          }));
          return;
        }

        if (room) {
          const joinedRoomIdValue = room._id || id;
          if (room.private) {
            rememberRoomPassword(joinedRoomIdValue, roomPassword);
          } else {
            forgetRoomPassword(joinedRoomIdValue);
          }

          store.dispatch(roomUpdated({
            ...room,
            password: room.private ? roomPassword || null : null,
          }));
          joinedRoomId = joinedRoomIdValue;
          flushPendingResult();

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

        if (room.private) {
          rememberRoomPassword(room._id, options.password);
        }
        store.dispatch(roomUpdated({
          ...room,
          password: room.private ? options.password : null,
        }));
        joinedRoomId = room._id;
        history.push(`/rooms/${room._id}`);
        flushPendingResult();
      });
    },
    [LEAVE_ROOM]: () => {
      joinedRoomId = null;
      pendingJoinRequest = null;
      joinGeneration += 1;
      if (store.getState().room._id) {
        namespace.emit(Protocol.LEAVE_ROOM);
      }
    },
    [SUBMIT_RESULT]: (event) => {
      const submission = currentSubmission();
      const storedPendingResult = readStoredPendingResult();

      if ((submission && submission.pendingResult) || storedPendingResult) {
        if (!submission.pendingResult && storedPendingResult) {
          store.dispatch(resultSubmissionPending(storedPendingResult));
        }
        store.dispatch(createMessage({
          severity: 'warning',
          text: 'A result is already waiting to be submitted.',
        }));
        return;
      }

      const { room, user } = store.getState();
      let pendingResult;
      try {
        pendingResult = createPendingResult({
          userId: user.id,
          roomId: room._id,
          attemptId: event.result.id,
          attemptKey: event.result.attemptKey,
          result: event.result.result,
        }, {
          createId: createSubmissionId,
          now,
        });
      } catch {
        store.dispatch(createMessage({
          severity: 'warning',
          text: 'This result is invalid and was not submitted.',
        }));
        return;
      }

      store.dispatch(resultSubmissionPending(pendingResult));
      try {
        persistPendingResult(pendingResult, storage);
      } catch {
        warnPendingResultNotBackedUp(pendingResult.submissionId);
      }

      flushPendingResult();
    },
    [DISCARD_PENDING_RESULT]: ({ submissionId }) => {
      const submission = currentSubmission();
      if (!submission.pendingResult
        || submission.pendingResult.submissionId !== submissionId) {
        return;
      }

      if (!canDiscardPendingResult(submission.pendingResult, submission.status)) {
        store.dispatch(createMessage({
          severity: 'warning',
          text: 'This result may already have reached the server and must finish submitting.',
        }));
        return;
      }

      invalidateSubmissionAttempt();
      try {
        if (!clearPendingResult(submissionId, storage)) {
          throw new Error('A newer result is saved on this device.');
        }
      } catch (storageError) {
        store.dispatch(resultSubmissionFailed(submissionId, {
          message: storageError.message || 'The saved result could not be discarded.',
          retryable: false,
        }));
        return;
      }
      store.dispatch(resultSubmissionCleared(submissionId));
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
      namespace.emit(Protocol.EDIT_ROOM, options, (err, room) => {
        if (err) {
          store.dispatch(createMessage({
            severity: 'error',
            text: err.message,
          }));
          return;
        }

        applySuccessfulRoomEdit(room, options);
      });
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

  return (next) => (action) => {
    if (!hydratedPendingResult) {
      hydratedPendingResult = true;
      const pendingResult = readStoredPendingResult();
      if (pendingResult) {
        store.dispatch(resultSubmissionPending(pendingResult));
      }
    }

    if (reducers[action.type]) {
      reducers[action.type](action);
    }
    next(action);
  };
};

export default createRoomsNamespaceMiddleware();
