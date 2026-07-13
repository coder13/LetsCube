const SUPER_ADMIN_ID = 8184;

const isRoomOwner = (userId, room) => !!userId && !!room && !!room.owner
  && +room.owner.id === +userId;

const isRoomAdmin = (userId, room) => !!userId && !!room && !!room.admin
  && +room.admin.id === +userId;

const canDeleteRoom = (userId, room) => {
  if (+userId === SUPER_ADMIN_ID) {
    return true;
  }

  if (!userId || !room) {
    return false;
  }

  return isRoomOwner(userId, room) || isRoomAdmin(userId, room);
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
  isRoomAdmin,
  isRoomOwner,
};
