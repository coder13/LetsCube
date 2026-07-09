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

module.exports = {
  canDeleteRoom,
};
