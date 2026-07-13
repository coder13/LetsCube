/* eslint-env jest */

const Protocol = require('../../../client/src/lib/protocol.json');
const metrics = require('../../metrics');
const { Room, User } = require('../../models');
const initRooms = require('./rooms');

jest.mock('../../runtimeConfig', () => ({
  grandPrix: { enabled: false },
  socketio: { reconnectGraceMs: 60000 },
}));
jest.mock('../../logger', () => ({
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}));
jest.mock('../../metrics', () => ({
  beginRoomVisit: jest.fn(),
  endRoomVisit: jest.fn(),
  recordRoomCreated: jest.fn(),
  recordRoomJoinFailure: jest.fn(),
}));
jest.mock('../../models', () => ({
  Room: {
    find: jest.fn(),
    findById: jest.fn(),
  },
  User: {
    find: jest.fn(),
  },
}));
jest.mock('../../postgres/dualWrite', () => ({
  markRoomDeleted: jest.fn(),
}));
jest.mock('../lib/reconnectGrace', () => ({
  createReconnectGrace: jest.fn(() => ({
    cancel: jest.fn().mockResolvedValue(false),
    finalize: jest.fn(),
    schedule: jest.fn(),
    startReconciliation: jest.fn(),
  })),
}));
jest.mock('../lib/socketHandler', () => ({
  createSafeSocketHandler: (socket) => (event, handler) => socket.on(event, handler),
  optionalAcknowledgment: (acknowledgment) => (
    typeof acknowledgment === 'function' ? acknowledgment : () => {}
  ),
}));

const queryResult = (value) => {
  const query = {
    populate: jest.fn(() => query),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return query;
};

const makeRoom = (overrides = {}) => ({
  _id: 'room-one',
  accessCode: 'PRIVATE',
  private: true,
  password: 'bcrypt-hash-one',
  type: 'normal',
  owner: { id: 101 },
  admin: { id: 101 },
  users: [],
  usersInRoom: [],
  inRoom: new Map(),
  banned: new Map(),
  registered: new Map(),
  requireRevealedIdentity: false,
  usersLength: 1,
  authenticate: jest.fn().mockResolvedValue(true),
  addUser: jest.fn().mockResolvedValue(false),
  ...overrides,
});

const makeSocket = ({
  id, session, userId = 202,
}) => {
  const handlers = {};
  return {
    id,
    userId,
    user: {
      id: userId,
      name: `User ${userId}`,
      showWCAID: true,
    },
    handshake: { session },
    handlers,
    broadcast: {
      to: jest.fn(() => ({ emit: jest.fn() })),
    },
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    on: jest.fn((event, handler) => {
      handlers[event] = handler;
    }),
    use: jest.fn(),
  };
};

const setup = (rooms) => {
  const namespace = {
    adapter: {
      allRooms: jest.fn().mockResolvedValue(new Set()),
      sockets: jest.fn().mockResolvedValue(new Set()),
    },
    emit: jest.fn(),
    in: jest.fn(() => ({ emit: jest.fn() })),
    on: jest.fn(),
    use: jest.fn(),
  };
  const io = { of: jest.fn().mockReturnValue(namespace) };
  let connect;
  namespace.on.mockImplementation((event, handler) => {
    if (event === 'connection') {
      connect = handler;
    }
  });
  Room.find.mockImplementation(() => queryResult([]));
  Room.findById.mockImplementation(({ _id }) => queryResult(rooms.get(String(_id))));
  User.find.mockResolvedValue([]);
  initRooms(io, []);

  return async (socket) => {
    await connect(socket);
    return socket;
  };
};

const joinRoom = async (socket, payload) => {
  const acknowledgment = jest.fn();
  await socket.handlers[Protocol.JOIN_ROOM](payload, acknowledgment);
  return acknowledgment;
};

describe('private room namespace joins', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    metrics.beginRoomVisit.mockResolvedValue(undefined);
    metrics.recordRoomJoinFailure.mockResolvedValue(undefined);
  });

  it('requires a valid password for a private room', async () => {
    const room = makeRoom({
      authenticate: jest.fn((password) => Promise.resolve(password === 'secret')),
    });
    const connect = setup(new Map([[room._id, room]]));
    const socket = await connect(makeSocket({ id: 'private-socket', session: {} }));

    const missingAcknowledgment = await joinRoom(socket, { id: room._id });
    expect(room.authenticate).not.toHaveBeenCalled();
    expect(missingAcknowledgment).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'password_required' }),
      expect.objectContaining({ _id: room._id, private: true }),
    );

    const invalidAcknowledgment = await joinRoom(socket, {
      id: room._id,
      password: 'incorrect',
    });
    expect(invalidAcknowledgment).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'invalid_password' }),
      expect.objectContaining({ _id: room._id, private: true }),
    );

    const validAcknowledgment = await joinRoom(socket, {
      id: room._id,
      password: 'secret',
    });
    expect(validAcknowledgment).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ _id: room._id, accessCode: room.accessCode }),
    );
  });

  it('accepts a duplicate join for the same room and rejects a different room', async () => {
    const room = makeRoom();
    const otherRoom = makeRoom({
      _id: 'room-two',
      accessCode: 'OTHER',
      private: false,
      password: null,
    });
    const connect = setup(new Map([
      [room._id, room],
      [otherRoom._id, otherRoom],
    ]));
    const socket = makeSocket({ id: 'joined-socket', session: {} });
    socket.roomId = room._id;
    socket.room = room;
    await connect(socket);

    const sameRoomAcknowledgment = await joinRoom(socket, { id: room._id });
    expect(sameRoomAcknowledgment).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ _id: room._id }),
    );

    const otherRoomAcknowledgment = await joinRoom(socket, { id: otherRoom._id });
    expect(otherRoomAcknowledgment).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'already_in_room' }),
      expect.objectContaining({ _id: otherRoom._id }),
    );
  });
});

describe('room namespace edits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('acknowledges a successful edit with the updated room', async () => {
    const room = makeRoom();
    room.edit = jest.fn().mockImplementation(async () => {
      room.password = 'bcrypt-hash-two';
      return room;
    });
    const connect = setup(new Map([[room._id, room]]));
    const socket = makeSocket({
      id: 'admin-socket',
      session: {},
      userId: room.admin.id,
    });
    socket.room = room;
    socket.roomId = room._id;
    await connect(socket);
    const acknowledgment = jest.fn();
    const options = {
      name: 'Renamed room',
      private: true,
      password: 'new-password',
      type: 'normal',
    };

    await socket.handlers[Protocol.EDIT_ROOM](options, acknowledgment);

    expect(room.edit).toHaveBeenCalledWith(options);
    expect(acknowledgment).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ _id: room._id, private: true }),
    );
  });

  it('returns an edit failure through the acknowledgment', async () => {
    const room = makeRoom();
    const error = Object.assign(new Error('A password is required'), { statusCode: 400 });
    room.edit = jest.fn().mockRejectedValue(error);
    const connect = setup(new Map([[room._id, room]]));
    const socket = makeSocket({
      id: 'admin-socket',
      session: {},
      userId: room.admin.id,
    });
    socket.room = room;
    socket.roomId = room._id;
    await connect(socket);
    const acknowledgment = jest.fn();

    await socket.handlers[Protocol.EDIT_ROOM]({
      name: 'Private room',
      private: true,
      type: 'normal',
    }, acknowledgment);

    expect(acknowledgment).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
      event: Protocol.EDIT_ROOM,
      message: 'A password is required',
    }));
  });
});
