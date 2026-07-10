
jest.mock('../../models', () => ({
  Room: {
    find: jest.fn(),
  },
}));

const { Room } = require('../../models');
const roomMap = require('./roomMap');

const chainRooms = (rooms) => {
  const query = {
    populate: jest.fn(),
  };

  query.populate.mockReturnValueOnce(query);
  query.populate.mockReturnValueOnce(query);
  query.populate.mockReturnValueOnce(Promise.resolve(rooms));

  Room.find.mockReturnValue(query);
};

describe('roomMap', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('maps rooms with namespace sockets and per-user room sockets', async () => {
    const roomId = 'room-123';
    const users = [
      { id: 101, displayName: 'Alice', toObject: () => ({ id: 101, displayName: 'Alice' }) },
      { id: 202, displayName: 'Bob', toObject: () => ({ id: 202, displayName: 'Bob' }) },
    ];
    const room = {
      _id: roomId,
      accessCode: 'access-123',
      name: 'Mapped Room',
      private: false,
      password: null,
      users,
      usersInRoom: users,
      inRoom: new Map(),
      expireAt: null,
      admin: { id: 101 },
      owner: { id: 101 },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const sockets = jest.fn(async (rooms) => {
      const [roomName] = Array.from(rooms);
      return new Set([`${roomName}-socket`]);
    });

    chainRooms([room]);

    const result = await roomMap(() => ({ adapter: { sockets } }));

    expect(Room.find).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: roomId,
      accessCode: 'access-123',
      name: 'Mapped Room',
      private: false,
      admin: { id: 101 },
      owner: { id: 101 },
    });
    expect(result[0].sockets).toEqual(new Set(['access-123-socket']));
    expect(result[0].userSocketsInRoom).toEqual([
      {
        id: 101,
        displayName: 'Alice',
        sockets: ['user-room/101-room-123-socket'],
      },
      {
        id: 202,
        displayName: 'Bob',
        sockets: ['user-room/202-room-123-socket'],
      },
    ]);
    expect(sockets).toHaveBeenCalledWith(new Set(['access-123']));
    expect(sockets).toHaveBeenCalledWith(new Set(['user-room/101-room-123']));
    expect(sockets).toHaveBeenCalledWith(new Set(['user-room/202-room-123']));
  });
});
