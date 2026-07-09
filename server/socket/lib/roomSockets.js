const { encodeUserRoom } = require('../utils');

const removeUserFromRoomSockets = (namespace, userId, room) => {
  const userRoom = encodeUserRoom(userId, room._id);
  namespace.in(userRoom).socketsLeave([room.accessCode, userRoom]);
};

module.exports = {
  removeUserFromRoomSockets,
};
