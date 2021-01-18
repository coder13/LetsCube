module.exports.encodeUser = (userId) => `user/${userId}`;
module.exports.encodeUserRoom = (userId, roomId) => `user-room/${userId}-${roomId}`;
