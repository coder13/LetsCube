const SUPER_ADMIN_ID = 8184;

const canDeleteRoom = (userId, room) => {
  if (+userId === SUPER_ADMIN_ID) {
    return true;
  }

  if (!userId || !room) {
    return false;
  }

  return [room.owner, room.admin].some((user) => user && +user.id === +userId);
};

const canAccessRoom = (userId, room) => {
  if (!room) {
    return false;
  }

  if (!userId) {
    return true;
  }

  const userKey = userId.toString();
  return !!room.inRoom.get(userKey) && !room.banned.get(userKey);
};

module.exports = {
  canAccessRoom,
  canDeleteRoom,
};
