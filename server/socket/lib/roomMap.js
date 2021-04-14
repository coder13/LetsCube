const { Room } = require('../../models');
const { encodeUserRoom } = require('../utils');

module.exports = async (ns) => {
  const rooms = await Room.find();

  return Promise.all(rooms.map(async (room) => {
    const sockets = await ns().adapter.sockets(new Set([room.accessCode]));

    const userSocketsInRoom = await Promise.all(room.usersInRoom.map(async (user) => ({
      ...user.toObject(),
      sockets: Array.from(await ns().adapter.sockets(new Set([encodeUserRoom(user.id, room._id)]))),
    })));

    return {
      id: room._id,
      accessCode: room.accessCode,
      name: room.name,
      private: room.private,
      password: room.password,
      users: room.users,
      inRoom: room.inRoom,
      expireAt: room.expireAt,
      admin: room.admin,
      owner: room.owner,
      userSocketsInRoom,
      sockets,
    };
  }));
};
