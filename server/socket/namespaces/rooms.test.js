/* eslint-env jest */

const Protocol = require('../../../client/src/lib/protocol.json');
const metrics = require('../../metrics');
const { Room, User } = require('../../models');
const { encodeUserRoom } = require('../utils');
const { createReconnectGrace } = require('../lib/reconnectGrace');
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
  createReconnectGrace: jest.fn(({ finalizeDeparture }) => ({
    cancel: jest.fn().mockResolvedValue(false),
    finalize: jest.fn(),
    finalizeDeparture,
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

const makeRoom = (overrides = {}) => {
  const room = {
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
    membershipRevision: 7,
    presenceRevision: new Map([['101', 7]]),
    requireRevealedIdentity: false,
    usersLength: 1,
    authenticate: jest.fn().mockResolvedValue(true),
    addUser: jest.fn().mockResolvedValue(false),
    advancePresenceRevision: jest.fn(),
  };
  Object.assign(room, overrides);
  if (!overrides.advancePresenceRevision) {
    room.advancePresenceRevision.mockResolvedValue(room);
  }
  return room;
};

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
  const roomChannel = { emit: jest.fn() };
  const namespace = {
    adapter: {
      allRooms: jest.fn().mockResolvedValue(new Set()),
      sockets: jest.fn().mockResolvedValue(new Set()),
    },
    emit: jest.fn(),
    in: jest.fn(() => roomChannel),
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

  const connectSocket = async (socket) => {
    await connect(socket);
    return socket;
  };
  connectSocket.namespace = namespace;
  connectSocket.roomChannel = roomChannel;
  return connectSocket;
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

  it('returns restored controls when the owner rejoins after an admin handoff', async () => {
    const owner = { id: 101 };
    const room = makeRoom({
      private: false,
      password: null,
      owner,
      admin: { id: 202 },
      inRoom: new Map([['101', false], ['202', true]]),
    });
    room.addUser.mockImplementation(async (user, spectating, onAdminChange) => {
      room.inRoom.set(user.id.toString(), true);
      room.admin = user;
      onAdminChange(room);
      return room;
    });
    room.advancePresenceRevision.mockResolvedValue(null);
    room.edit = jest.fn().mockResolvedValue(room);
    const connect = setup(new Map([[room._id, room]]));
    const socket = await connect(makeSocket({
      id: 'owner-socket',
      session: {},
      userId: owner.id,
    }));

    const joinAcknowledgment = await joinRoom(socket, { id: room._id });

    expect(joinAcknowledgment).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ admin: expect.objectContaining({ id: owner.id }) }),
    );
    expect(connect.roomChannel.emit).toHaveBeenCalledWith(
      Protocol.UPDATE_ADMIN,
      expect.objectContaining({ id: owner.id }),
    );

    const editAcknowledgment = jest.fn();
    await socket.handlers[Protocol.EDIT_ROOM]({
      name: 'Owner is back',
      private: false,
      type: 'normal',
    }, editAcknowledgment);

    expect(room.edit).toHaveBeenCalledTimes(1);
    expect(editAcknowledgment).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ admin: expect.objectContaining({ id: owner.id }) }),
    );
  });

  it('does not change ownership when a disabled Grand Prix room is joined', async () => {
    const room = makeRoom({
      type: 'grand_prix',
      private: false,
      password: null,
      admin: { id: 202 },
    });
    const connect = setup(new Map([[room._id, room]]));
    const socket = await connect(makeSocket({ id: 'grand-prix-socket', session: {} }));

    const acknowledgment = await joinRoom(socket, { id: room._id });

    expect(acknowledgment).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'grand_prix_disabled' }),
      expect.objectContaining({ _id: room._id }),
    );
    expect(room.addUser).not.toHaveBeenCalled();
    expect(room.admin).toEqual({ id: 202 });
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

describe('room namespace departures and moderation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    metrics.endRoomVisit.mockResolvedValue(undefined);
  });

  it('does not send a null admin update to a spectator channel when a room empties', async () => {
    const room = makeRoom({
      private: false,
      password: null,
      usersLength: 0,
      inRoom: new Map([['101', true]]),
      doneWithScramble: jest.fn().mockReturnValue(false),
    });
    room.dropUserAtomically = jest.fn().mockResolvedValue({
      room: {
        ...room,
        admin: null,
      },
      adminChanged: true,
    });
    const connect = setup(new Map([[room._id, room]]));
    await connect(makeSocket({ id: 'spectator-socket', session: {} }));
    const reconnectGrace = createReconnectGrace.mock.results[0].value;

    await reconnectGrace.finalizeDeparture({
      roomId: room._id,
      userId: 101,
      connectionId: 'host-socket',
      membershipRevision: room.membershipRevision,
      presenceRevision: room.presenceRevision.get('101'),
      leaveReason: 'explicit',
    });

    expect(connect.roomChannel.emit).not.toHaveBeenCalledWith(Protocol.UPDATE_ADMIN, null);
    expect(connect.roomChannel.emit).toHaveBeenCalledWith(Protocol.USER_LEFT, 101);
  });

  it('does not let a losing departure remove a later rejoin', async () => {
    const room = makeRoom({
      private: false,
      password: null,
      inRoom: new Map([['101', true]]),
    });
    const updatedRoom = {
      ...room,
      inRoom: new Map([['101', false]]),
      membershipRevision: 8,
      usersLength: 0,
      doneWithScramble: jest.fn().mockReturnValue(false),
    };
    room.dropUserAtomically = jest.fn().mockResolvedValue({
      room: updatedRoom,
      adminChanged: false,
    });
    const connect = setup(new Map([[room._id, room]]));
    let persistedRoom = room;
    Room.findById.mockImplementation(() => queryResult(persistedRoom));
    const reconnectGrace = createReconnectGrace.mock.results[0].value;

    await expect(reconnectGrace.finalizeDeparture({
      roomId: room._id,
      userId: 101,
      connectionId: 'winner-socket',
      membershipRevision: 7,
      presenceRevision: 7,
      leaveReason: 'explicit',
    })).resolves.toBe(true);

    const rejoinedRoom = {
      ...room,
      admin: { id: 101 },
      inRoom: new Map([['101', true]]),
      membershipRevision: 9,
      presenceRevision: new Map([['101', 9]]),
    };
    persistedRoom = rejoinedRoom;

    await expect(reconnectGrace.finalizeDeparture({
      roomId: room._id,
      userId: 101,
      connectionId: 'loser-socket',
      membershipRevision: 7,
      presenceRevision: 7,
      leaveReason: 'explicit',
    })).resolves.toBe(false);

    expect(room.dropUserAtomically).toHaveBeenCalledTimes(1);
    expect(rejoinedRoom.inRoom.get('101')).toBe(true);
    expect(rejoinedRoom.admin).toEqual({ id: 101 });
    expect(rejoinedRoom.membershipRevision).toBe(updatedRoom.membershipRevision + 1);
    expect(metrics.endRoomVisit).toHaveBeenCalledTimes(1);
    expect(connect.roomChannel.emit).toHaveBeenCalledTimes(1);
    expect(connect.roomChannel.emit).toHaveBeenCalledWith(Protocol.USER_LEFT, 101);
  });

  it('fences an active duplicate join before an older departure can finalize', async () => {
    const room = makeRoom({
      private: false,
      password: null,
      inRoom: new Map([['101', true]]),
    });
    const fencedRoom = {
      ...room,
      presenceRevision: new Map([['101', 8]]),
    };
    room.advancePresenceRevision.mockResolvedValue(fencedRoom);
    const connect = setup(new Map([[room._id, room]]));
    const socket = await connect(makeSocket({ id: 'new-tab', session: {}, userId: 101 }));

    const acknowledgment = await joinRoom(socket, { id: room._id });

    expect(acknowledgment).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ _id: room._id }),
    );
    expect(room.advancePresenceRevision).toHaveBeenCalledWith(101);

    Room.findById.mockImplementation(() => queryResult(fencedRoom));
    const reconnectGrace = createReconnectGrace.mock.results[0].value;

    await expect(reconnectGrace.finalizeDeparture({
      roomId: room._id,
      userId: 101,
      connectionId: 'old-tab',
      membershipRevision: 7,
      presenceRevision: 7,
      leaveReason: 'explicit',
    })).resolves.toBe(false);

    expect(room.dropUserAtomically).toBeUndefined();
    expect(fencedRoom.inRoom.get('101')).toBe(true);
    expect(fencedRoom.admin).toEqual({ id: 101 });
  });

  it('joins normally when a departure wins before the duplicate presence fence', async () => {
    const room = makeRoom({
      private: false,
      password: null,
      inRoom: new Map([['101', true]]),
    });
    room.advancePresenceRevision.mockResolvedValue(null);
    const rejoinedRoom = {
      ...room,
      inRoom: new Map([['101', true]]),
      membershipRevision: 8,
      presenceRevision: new Map([['101', 8]]),
    };
    const departedRoom = {
      ...room,
      inRoom: new Map([['101', false]]),
      addUser: jest.fn().mockResolvedValue(rejoinedRoom),
    };
    const connect = setup(new Map([[room._id, room]]));
    let fetchCount = 0;
    Room.findById.mockImplementation(() => {
      const fetchedRoom = fetchCount === 0 ? room : departedRoom;
      fetchCount += 1;
      return queryResult(fetchedRoom);
    });
    const socket = await connect(makeSocket({ id: 'new-tab', session: {}, userId: 101 }));

    const acknowledgment = await joinRoom(socket, { id: room._id });

    expect(departedRoom.addUser).toHaveBeenCalledWith(
      socket.user,
      undefined,
      expect.any(Function),
    );
    expect(acknowledgment).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ _id: room._id }),
    );
    expect(socket.room).toBe(rejoinedRoom);
  });

  it('finalizes one departure when two tabs explicitly leave together', async () => {
    const room = makeRoom({
      private: false,
      password: null,
      inRoom: new Map([['101', true]]),
    });
    const connect = setup(new Map([[room._id, room]]));
    const first = makeSocket({ id: 'first-tab', session: {}, userId: 101 });
    const second = makeSocket({ id: 'second-tab', session: {}, userId: 101 });
    const activeSocketIds = new Set([first.id, second.id]);
    const userRoom = encodeUserRoom(101, room._id);
    connect.namespace.adapter.sockets.mockImplementation(async () => new Set(activeSocketIds));
    [first, second].forEach((socket) => {
      socket.room = room;
      socket.roomId = room._id;
      socket.leave.mockImplementation((roomName) => {
        if (roomName === userRoom) {
          activeSocketIds.delete(socket.id);
        }
      });
    });
    await connect(first);
    await connect(second);
    const reconnectGrace = createReconnectGrace.mock.results[0].value;

    await Promise.all([
      first.handlers[Protocol.LEAVE_ROOM](),
      second.handlers[Protocol.LEAVE_ROOM](),
    ]);

    expect(reconnectGrace.finalize).toHaveBeenCalledTimes(1);
    expect(reconnectGrace.finalize).toHaveBeenCalledWith(expect.objectContaining({
      roomId: room._id,
      userId: 101,
      membershipRevision: room.membershipRevision,
      leaveReason: 'explicit',
    }));
  });

  it('rejects raw self-kick and self-ban requests from an admin', async () => {
    const room = makeRoom({
      private: false,
      password: null,
      admin: { id: 101 },
      dropUser: jest.fn(),
      banUser: jest.fn(),
    });
    const connect = setup(new Map([[room._id, room]]));
    const socket = makeSocket({ id: 'admin-socket', session: {}, userId: 101 });
    socket.room = room;
    socket.roomId = room._id;
    await connect(socket);

    await socket.handlers[Protocol.KICK_USER](101);
    await socket.handlers[Protocol.BAN_USER]('101');

    expect(room.dropUser).not.toHaveBeenCalled();
    expect(room.banUser).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith(Protocol.ERROR, expect.objectContaining({
      statusCode: 400,
      event: Protocol.KICK_USER,
    }));
    expect(socket.emit).toHaveBeenCalledWith(Protocol.ERROR, expect.objectContaining({
      statusCode: 400,
      event: Protocol.BAN_USER,
    }));
  });
});
