import {
  applyMiddleware, combineReducers, createStore,
} from 'redux';
import Protocol from '../../lib/protocol';
import roomReducer from '../room/reducer';
import roomsReducer from '../rooms/reducer';
import messagesReducer from '../messages/reducers';
import {
  discardPendingResult,
  editRoom,
  joinRoom,
  submitResult,
} from '../room/actions';
import { connectSocket, createRoom } from '../rooms/actions';
import {
  PENDING_RESULT_STORAGE_KEY,
  createPendingResult,
  markPendingResultAttempted,
  markPendingResultFailed,
  persistPendingResult,
} from '../room/resultOutbox';
import {
  persistRoomPassword,
  readRoomPassword,
} from '../room/roomPasswordStorage';
import { createRoomsNamespaceMiddleware } from './rooms';

jest.mock('./manager', () => ({
  manager: {
    connect: jest.fn(),
    disconnect: jest.fn(),
  },
}));

class FakeNamespace {
  constructor(options) {
    this.options = options;
    this.emitted = [];
    FakeNamespace.instance = this;
  }

  connect() {
    this.connected = true;
  }

  disconnect() {
    this.connected = false;
  }

  emit(event, ...args) {
    this.emitted.push({
      event,
      args,
      pendingResultAtEmit: window.localStorage.getItem(PENDING_RESULT_STORAGE_KEY),
    });
  }
}

const makeScheduler = () => {
  let nextId = 1;
  const timers = new Map();

  return {
    setTimeoutFn: (callback, delay) => {
      const id = nextId;
      nextId += 1;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeoutFn: (id) => timers.delete(id),
    runNext: (delay) => {
      const entry = Array.from(timers.entries()).find(([, timer]) => timer.delay === delay);
      if (!entry) {
        throw new Error(`No timer scheduled for ${delay}ms.`);
      }
      const [id, timer] = entry;
      timers.delete(id);
      timer.callback();
    },
  };
};

const initialRoom = () => ({
  ...roomReducer(undefined, { type: '@@INIT' }),
  fetching: false,
  _id: 'room-one',
  accessCode: 'ABC123',
  password: null,
  users: [{ id: 42, displayName: 'Cuber' }],
  competing: { 42: true },
  waitingFor: { 42: true },
  attempts: [{
    _id: 'attempt-one', id: 12, scrambles: ['R U'], results: {},
  }],
});

const buildStore = ({
  roomState = initialRoom(),
  storage = window.localStorage,
} = {}) => {
  const scheduler = makeScheduler();
  const namespaceManager = {
    connect: jest.fn(),
    disconnect: jest.fn(),
  };
  const middleware = createRoomsNamespaceMiddleware({
    NamespaceClass: FakeNamespace,
    namespaceManager,
    storage,
    createSubmissionId: () => 'submission-one',
    now: () => 1000,
    setTimeoutFn: scheduler.setTimeoutFn,
    clearTimeoutFn: scheduler.clearTimeoutFn,
    ackTimeoutMs: 100,
    retryDelayMs: 25,
  });
  const reducer = combineReducers({
    room: roomReducer,
    roomList: roomsReducer,
    messages: messagesReducer,
    user: (state = { id: 42, muteTimer: true }) => state,
    chat: (state = {}) => state,
    admin: (state = {}) => state,
  });
  const store = createStore(reducer, {
    room: roomState,
    roomList: roomsReducer(undefined, { type: '@@INIT' }),
    messages: messagesReducer(undefined, { type: '@@INIT' }),
    user: { id: 42, muteTimer: true },
    chat: {},
    admin: {},
  }, applyMiddleware(middleware));

  return {
    namespace: FakeNamespace.instance,
    scheduler,
    store,
  };
};

const emissionsFor = (namespace, event) => (
  namespace.emitted.filter((emission) => emission.event === event)
);

const acknowledgeJoin = (namespace) => {
  const join = emissionsFor(namespace, Protocol.JOIN_ROOM).slice(-1)[0];
  const room = initialRoom();
  delete room.resultSubmission;
  join.args[1](null, room);
};

const result = {
  id: 12,
  attemptKey: 'attempt-one',
  result: {
    time: 1234,
    penalties: {},
  },
};

describe('rooms middleware', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keeps the loaded room mounted while reconnecting its socket', () => {
    const { namespace, store } = buildStore();
    const { attempts } = store.getState().room;
    store.dispatch(connectSocket());

    namespace.options.onConnected();

    expect(emissionsFor(namespace, Protocol.JOIN_ROOM)).toHaveLength(1);
    expect(store.getState().room.fetching).toBe(false);
    expect(store.getState().room.attempts).toBe(attempts);
  });

  it('waits for the socket connection before emitting the initial room join', () => {
    const { namespace, store } = buildStore({
      roomState: {
        ...initialRoom(),
        _id: null,
        accessCode: null,
      },
    });
    store.dispatch(connectSocket());
    store.dispatch(joinRoom({ id: 'room-two', password: 'secret' }));

    expect(emissionsFor(namespace, Protocol.JOIN_ROOM)).toHaveLength(0);

    namespace.options.onConnected();

    const joins = emissionsFor(namespace, Protocol.JOIN_ROOM);
    expect(joins).toHaveLength(1);
    expect(joins[0].args[0]).toEqual({ id: 'room-two', password: 'secret' });
  });

  it('uses a saved private room password after a refresh', () => {
    persistRoomPassword('private-room', 'saved-password');
    const { namespace, store } = buildStore({
      roomState: {
        ...initialRoom(),
        _id: null,
        accessCode: null,
      },
    });
    store.dispatch(connectSocket());
    namespace.options.onConnected();
    store.dispatch(joinRoom({ id: 'private-room' }));

    const join = emissionsFor(namespace, Protocol.JOIN_ROOM)[0];
    expect(join.args[0]).toEqual({
      id: 'private-room',
      password: 'saved-password',
    });

    const joinedRoom = {
      ...initialRoom(),
      _id: 'private-room',
      accessCode: 'PRIVATE',
      private: true,
    };
    delete joinedRoom.resultSubmission;
    join.args[1](null, joinedRoom);

    expect(store.getState().room.password).toBe('saved-password');
    expect(readRoomPassword('private-room')).toBe('saved-password');
  });

  it('remembers a successful private room password', () => {
    const roomState = {
      ...initialRoom(),
      _id: null,
      accessCode: null,
    };
    const built = buildStore({ roomState });
    built.store.dispatch(connectSocket());
    built.namespace.options.onConnected();
    built.store.dispatch(joinRoom({ id: 'private-room', password: 'secret' }));

    const join = emissionsFor(built.namespace, Protocol.JOIN_ROOM)[0];
    const joinedRoom = {
      ...initialRoom(),
      _id: 'private-room',
      accessCode: 'PRIVATE',
      private: true,
    };
    delete joinedRoom.resultSubmission;
    join.args[1](null, joinedRoom);
    expect(readRoomPassword('private-room')).toBe('secret');
    expect(built.store.getState().room.password).toBe('secret');
  });

  it('clears a rejected stored password and shows the password form', () => {
    persistRoomPassword('private-room', 'stale-password');
    const { namespace, store } = buildStore({
      roomState: {
        ...initialRoom(),
        _id: null,
        accessCode: null,
      },
    });
    store.dispatch(connectSocket());
    namespace.options.onConnected();
    store.dispatch(joinRoom({ id: 'private-room' }));

    const joins = emissionsFor(namespace, Protocol.JOIN_ROOM);
    expect(joins).toHaveLength(1);
    expect(joins[0].args[0]).toEqual({
      id: 'private-room',
      password: 'stale-password',
    });

    joins[0].args[1]({
      statusCode: 403,
      message: 'Invalid password',
      reason: 'invalid_password',
    }, {
      _id: 'private-room',
      name: 'Private room',
      private: true,
      type: 'normal',
    });

    expect(readRoomPassword('private-room')).toBeNull();
    expect(emissionsFor(namespace, Protocol.JOIN_ROOM)).toHaveLength(1);
    expect(store.getState().room).toMatchObject({
      _id: 'private-room',
      private: true,
      fetching: false,
    });
    expect(store.getState().room.joinError.message).toBe('Invalid password');
  });

  it('remembers the password for a newly created private room', () => {
    const { namespace, store } = buildStore();
    store.dispatch(connectSocket());
    namespace.options.onConnected();
    store.dispatch(createRoom({
      name: 'Private room',
      password: 'new-password',
      private: true,
      type: 'normal',
    }));

    const creation = emissionsFor(namespace, Protocol.CREATE_ROOM)[0];
    creation.args[1](null, {
      ...initialRoom(),
      _id: 'new-private-room',
      accessCode: 'NEWPRIVATE',
      private: true,
    });

    expect(readRoomPassword('new-private-room')).toBe('new-password');
    expect(store.getState().room.password).toBe('new-password');
  });

  it('remembers a changed private room password after the edit succeeds', () => {
    persistRoomPassword('room-one', 'old-password');
    const { namespace, store } = buildStore({
      roomState: {
        ...initialRoom(),
        private: true,
        password: 'old-password',
      },
    });
    store.dispatch(editRoom({
      name: 'Private room',
      private: true,
      password: 'new-password',
      type: 'normal',
    }));

    const edit = emissionsFor(namespace, Protocol.EDIT_ROOM)[0];
    expect(readRoomPassword('room-one')).toBe('old-password');

    edit.args[1](null, {
      ...initialRoom(),
      private: true,
    });

    expect(readRoomPassword('room-one')).toBe('new-password');
    expect(store.getState().room.password).toBe('new-password');
  });

  it('keeps the saved password when an edit does not replace it', () => {
    persistRoomPassword('room-one', 'existing-password');
    const { namespace, store } = buildStore({
      roomState: {
        ...initialRoom(),
        private: true,
        password: 'existing-password',
      },
    });
    store.dispatch(editRoom({
      name: 'Renamed room',
      private: true,
      password: undefined,
      type: 'normal',
    }));

    const edit = emissionsFor(namespace, Protocol.EDIT_ROOM)[0];
    edit.args[1](null, {
      ...initialRoom(),
      name: 'Renamed room',
      private: true,
    });

    expect(readRoomPassword('room-one')).toBe('existing-password');
    expect(store.getState().room.password).toBe('existing-password');
  });

  it('keeps the saved password when a private room edit fails', () => {
    persistRoomPassword('room-one', 'existing-password');
    const { namespace, store } = buildStore({
      roomState: {
        ...initialRoom(),
        private: true,
        password: 'existing-password',
      },
    });
    store.dispatch(editRoom({
      name: 'Private room',
      private: true,
      password: 'rejected-password',
      type: 'normal',
    }));

    const edit = emissionsFor(namespace, Protocol.EDIT_ROOM)[0];
    edit.args[1]({
      statusCode: 500,
      message: 'Failed to edit room',
    });

    expect(readRoomPassword('room-one')).toBe('existing-password');
    expect(store.getState().room.password).toBe('existing-password');
  });

  it('clears the saved password after making a room public', () => {
    persistRoomPassword('room-one', 'existing-password');
    const { namespace, store } = buildStore({
      roomState: {
        ...initialRoom(),
        private: true,
        password: 'existing-password',
      },
    });
    store.dispatch(editRoom({
      name: 'Public room',
      private: false,
      password: null,
      type: 'normal',
    }));

    const edit = emissionsFor(namespace, Protocol.EDIT_ROOM)[0];
    expect(readRoomPassword('room-one')).toBe('existing-password');

    edit.args[1](null, {
      ...initialRoom(),
      name: 'Public room',
      private: false,
    });

    expect(readRoomPassword('room-one')).toBeNull();
    expect(store.getState().room.password).toBeNull();
  });

  it('clears the saved password when a room update makes it public', () => {
    persistRoomPassword('room-one', 'existing-password');
    const { namespace, store } = buildStore({
      roomState: {
        ...initialRoom(),
        private: true,
        password: 'existing-password',
      },
    });

    namespace.options.events[Protocol.UPDATE_ROOM]({
      ...initialRoom(),
      private: false,
    });

    expect(readRoomPassword('room-one')).toBeNull();
    expect(store.getState().room.password).toBeNull();
  });

  it('loads the private room mask when a password is required', () => {
    const { namespace, store } = buildStore({
      roomState: {
        ...initialRoom(),
        _id: null,
        accessCode: null,
      },
    });
    store.dispatch(connectSocket());
    namespace.options.onConnected();
    store.dispatch(joinRoom({ id: 'private-room' }));

    const join = emissionsFor(namespace, Protocol.JOIN_ROOM)[0];
    join.args[1]({
      statusCode: 403,
      message: 'Room requires password to join',
    }, {
      _id: 'private-room',
      name: 'Private room',
      private: true,
      type: 'normal',
    });

    expect(store.getState().room).toMatchObject({
      _id: 'private-room',
      fetching: false,
      private: true,
    });
    expect(emissionsFor(namespace, Protocol.SUBMIT_RESULT)).toHaveLength(0);
  });

  it('submits a restored result after private room access is restored', () => {
    persistPendingResult(createPendingResult({
      userId: 42,
      roomId: 'private-room',
      attemptId: 12,
      attemptKey: 'attempt-one',
      result: { time: 1234, penalties: {} },
    }, {
      createId: () => 'restored-submission',
      now: () => 500,
    }));
    const { namespace, store } = buildStore({
      roomState: {
        ...initialRoom(),
        _id: null,
        accessCode: null,
      },
    });
    store.dispatch(connectSocket());
    namespace.options.onConnected();
    store.dispatch(joinRoom({ id: 'private-room' }));

    let join = emissionsFor(namespace, Protocol.JOIN_ROOM)[0];
    join.args[1]({
      statusCode: 403,
      message: 'Room requires password to join',
      reason: 'password_required',
    }, {
      _id: 'private-room',
      name: 'Private room',
      private: true,
      type: 'normal',
    });

    expect(emissionsFor(namespace, Protocol.SUBMIT_RESULT)).toHaveLength(0);

    store.dispatch(joinRoom({ id: 'private-room', password: 'secret' }));
    [, join] = emissionsFor(namespace, Protocol.JOIN_ROOM);
    const joinedRoom = {
      ...initialRoom(),
      _id: 'private-room',
      accessCode: 'PRIVATE',
      private: true,
    };
    delete joinedRoom.resultSubmission;
    join.args[1](null, joinedRoom);

    const submissions = emissionsFor(namespace, Protocol.SUBMIT_RESULT);
    expect(submissions).toHaveLength(1);
    expect(submissions[0].args[0].submissionId).toBe('restored-submission');
  });

  it('persists while disconnected and submits only after the room join acknowledgement', () => {
    const { namespace, store } = buildStore();
    store.dispatch(connectSocket());

    store.dispatch(submitResult(result));

    expect(window.localStorage.getItem(PENDING_RESULT_STORAGE_KEY)).not.toBeNull();
    expect(emissionsFor(namespace, Protocol.SUBMIT_RESULT)).toHaveLength(0);

    namespace.options.onConnected();
    expect(emissionsFor(namespace, Protocol.JOIN_ROOM)).toHaveLength(1);
    expect(emissionsFor(namespace, Protocol.SUBMIT_RESULT)).toHaveLength(0);

    acknowledgeJoin(namespace);

    const submission = emissionsFor(namespace, Protocol.SUBMIT_RESULT)[0];
    expect(submission.pendingResultAtEmit).not.toBeNull();
    expect(JSON.parse(submission.pendingResultAtEmit).deliveryAttempted).toBe(true);
    expect(submission.args[0]).toEqual({
      id: 12,
      attemptKey: 'attempt-one',
      result: result.result,
      submissionId: 'submission-one',
    });

    submission.args[1](null, {
      submissionId: 'submission-one',
      status: 'saved',
    });

    expect(window.localStorage.getItem(PENDING_RESULT_STORAGE_KEY)).toBeNull();
    expect(store.getState().room.resultSubmission.status).toBe('idle');
  });

  it('still submits from memory when local storage is unavailable', () => {
    const storage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(() => {
        throw new Error('storage unavailable');
      }),
      removeItem: jest.fn(),
    };
    const { namespace, store } = buildStore({ storage });
    store.dispatch(connectSocket());
    namespace.options.onConnected();
    acknowledgeJoin(namespace);

    store.dispatch(submitResult(result));

    expect(storage.setItem).toHaveBeenCalledTimes(2);
    expect(emissionsFor(namespace, Protocol.SUBMIT_RESULT)).toHaveLength(1);
    expect(store.getState().room.resultSubmission.status).toBe('sending');
    expect(store.getState().messages.messages.some((message) => (
      message.text.includes('Keep this tab open')
    ))).toBe(true);
  });

  it('retries a transient error with the same submission id', () => {
    const { namespace, scheduler, store } = buildStore();
    store.dispatch(connectSocket());
    namespace.options.onConnected();
    acknowledgeJoin(namespace);

    store.dispatch(submitResult(result));
    const firstSubmission = emissionsFor(namespace, Protocol.SUBMIT_RESULT)[0];
    firstSubmission.args[1]({ message: 'MongoDB unavailable', retryable: true });

    expect(store.getState().room.resultSubmission.status).toBe('pending');
    scheduler.runNext(25);

    const submissions = emissionsFor(namespace, Protocol.SUBMIT_RESULT);
    expect(submissions).toHaveLength(2);
    expect(submissions[1].args[0].submissionId).toBe(submissions[0].args[0].submissionId);
  });

  it('does not discard a result after delivery has started', () => {
    const { namespace, scheduler, store } = buildStore();
    store.dispatch(connectSocket());
    namespace.options.onConnected();
    acknowledgeJoin(namespace);

    store.dispatch(submitResult(result));
    scheduler.runNext(100);
    store.dispatch(discardPendingResult('submission-one'));

    expect(store.getState().room.resultSubmission.status).toBe('pending');
    expect(window.localStorage.getItem(PENDING_RESULT_STORAGE_KEY)).not.toBeNull();

    scheduler.runNext(25);
    expect(emissionsFor(namespace, Protocol.SUBMIT_RESULT)).toHaveLength(2);
  });

  it('protects a restored result that may already have reached the server', () => {
    const restoredResult = markPendingResultAttempted(createPendingResult({
      userId: 42,
      roomId: 'room-one',
      attemptId: 12,
      attemptKey: 'attempt-one',
      result: { time: 1234, penalties: {} },
    }, {
      createId: () => 'restored-submission',
      now: () => 500,
    }));
    persistPendingResult(restoredResult);

    const { store } = buildStore();
    store.dispatch(discardPendingResult('restored-submission'));

    expect(store.getState().room.resultSubmission.pendingResult).toEqual(restoredResult);
    expect(window.localStorage.getItem(PENDING_RESULT_STORAGE_KEY)).not.toBeNull();
  });

  it('rejects an invalid result without blocking the next valid result', () => {
    const { namespace, store } = buildStore();
    store.dispatch(connectSocket());
    namespace.options.onConnected();
    acknowledgeJoin(namespace);

    store.dispatch(submitResult({
      ...result,
      result: { time: undefined, penalties: {} },
    }));

    expect(store.getState().room.resultSubmission.status).toBe('idle');
    expect(emissionsFor(namespace, Protocol.SUBMIT_RESULT)).toHaveLength(0);

    store.dispatch(submitResult(result));
    expect(emissionsFor(namespace, Protocol.SUBMIT_RESULT)).toHaveLength(1);
  });

  it('accepts an exact self result echo as a legacy persistence receipt', () => {
    const { namespace, store } = buildStore();
    store.dispatch(connectSocket());
    namespace.options.onConnected();
    acknowledgeJoin(namespace);

    store.dispatch(submitResult(result));
    const submission = emissionsFor(namespace, Protocol.SUBMIT_RESULT)[0];

    namespace.options.events[Protocol.NEW_RESULT]({
      id: 12,
      userId: 42,
      result: { time: 1234, penalties: { DNF: true } },
    });
    expect(store.getState().room.resultSubmission.status).toBe('sending');

    namespace.options.events[Protocol.NEW_RESULT]({
      id: 12,
      userId: 42,
      result: { time: 1234, penalties: {}, submissionId: 'another-submission' },
    });
    expect(store.getState().room.resultSubmission.status).toBe('sending');

    namespace.options.events[Protocol.NEW_RESULT]({
      id: 12,
      userId: 42,
      result: { time: 1234, penalties: {}, submissionId: 'submission-one' },
    });
    expect(store.getState().room.resultSubmission.status).toBe('sending');

    namespace.options.events[Protocol.NEW_RESULT]({
      id: 12,
      userId: 42,
      result: { time: 1234, penalties: {} },
    });

    expect(window.localStorage.getItem(PENDING_RESULT_STORAGE_KEY)).toBeNull();
    expect(store.getState().room.resultSubmission.status).toBe('idle');

    submission.args[1](null, {
      submissionId: 'submission-one',
      status: 'saved',
    });
    expect(store.getState().room.resultSubmission.status).toBe('idle');
  });

  it('retains a terminal failure until the user explicitly discards it', () => {
    const { namespace, store } = buildStore();
    store.dispatch(connectSocket());
    namespace.options.onConnected();
    acknowledgeJoin(namespace);

    store.dispatch(submitResult(result));
    const submission = emissionsFor(namespace, Protocol.SUBMIT_RESULT)[0];
    submission.args[1]({ message: 'Attempt already has a result', retryable: false });

    expect(store.getState().room.resultSubmission.status).toBe('failed');
    expect(JSON.parse(
      window.localStorage.getItem(PENDING_RESULT_STORAGE_KEY),
    ).terminalFailure).toBe(true);

    store.dispatch(discardPendingResult('submission-one'));

    expect(store.getState().room.resultSubmission.status).toBe('idle');
    expect(window.localStorage.getItem(PENDING_RESULT_STORAGE_KEY)).toBeNull();
  });

  it('restores a terminal failure as discardable after a refresh', () => {
    const failedResult = markPendingResultFailed(createPendingResult({
      userId: 42,
      roomId: 'room-one',
      attemptId: 12,
      attemptKey: 'attempt-one',
      result: { time: 1234, penalties: {} },
    }, {
      createId: () => 'restored-submission',
      now: () => 500,
    }), {
      statusCode: 409,
      message: 'A result already exists for this attempt',
      retryable: false,
    });
    persistPendingResult(failedResult);

    const { store } = buildStore();
    store.dispatch(discardPendingResult('restored-submission'));

    expect(store.getState().room.resultSubmission.status).toBe('idle');
    expect(window.localStorage.getItem(PENDING_RESULT_STORAGE_KEY)).toBeNull();
  });

  it('does not submit a restored result for a different user or room', () => {
    const restoredResult = createPendingResult({
      userId: 99,
      roomId: 'room-two',
      attemptId: 8,
      attemptKey: 'attempt-two',
      result: { time: 999, penalties: {} },
    }, {
      createId: () => 'restored-submission',
      now: () => 500,
    });
    persistPendingResult(restoredResult);

    const { namespace, store } = buildStore();
    store.dispatch(connectSocket());
    namespace.options.onConnected();
    acknowledgeJoin(namespace);

    expect(store.getState().room.resultSubmission.pendingResult).toEqual(restoredResult);
    expect(emissionsFor(namespace, Protocol.SUBMIT_RESULT)).toHaveLength(0);
  });

  it('replays an interrupted initial room join after reconnecting', () => {
    const { namespace, store } = buildStore({
      roomState: {
        ...initialRoom(),
        _id: null,
        accessCode: null,
      },
    });
    store.dispatch(connectSocket());
    namespace.options.onConnected();
    store.dispatch(joinRoom({ id: 'room-two', password: 'secret' }));

    expect(emissionsFor(namespace, Protocol.JOIN_ROOM)).toHaveLength(1);
    namespace.options.onDisconnected();
    namespace.options.onConnected();

    const joins = emissionsFor(namespace, Protocol.JOIN_ROOM);
    expect(joins).toHaveLength(2);
    expect(joins[1].args[0]).toEqual({ id: 'room-two', password: 'secret' });

    joins[1].args[1](null, {
      ...initialRoom(),
      _id: 'room-two',
      accessCode: 'ROOM2',
    });
    expect(store.getState().room.fetching).toBe(false);
    expect(store.getState().room._id).toBe('room-two');
  });
});
