// socket.io event names
module.exports = {
  MESSAGE: 'message',
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERR: 'connect_error',
  RECONNECT_ERR: 'reconnect_error',
  RECONNECT: 'reconnect',
  ERROR: 'errorrr',
  UPDATE_ROOMS: 'update_rooms',
  UPDATE_ROOM: 'update_room',
  GLOBAL_ROOM_UPDATED: 'global_room_updated',
  CREATE_ROOM: 'create_room',
  DELETE_ROOM: 'delete_room',
  ROOM_CREATED: 'room_created',
  ROOM_DELETED: 'room_deleted',
  UPDATE_ADMIN: 'update_admin',
  FORCE_JOIN: 'force_join',
  FORCE_LEAVE: 'force_leave',
  KICKED: 'kicked',
  BANNED: 'banned',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  JOIN: 'join',
  USER_JOIN: 'user_join',
  USER_LEFT: 'user_left',
  SUBMIT_RESULT: 'submit_result',
  NEW_RESULT: 'new_result',
  SEND_EDIT_RESULT: 'send_edit_result',
  EDIT_RESULT: 'edit_result',
  NEW_ATTEMPT: 'new_attempt',
  REQUEST_SCRAMBLE: 'request_scramble',
  CHANGE_EVENT: 'change_event',
  EDIT_ROOM: 'edit_room',
  UPDATE_PREFERENCES: 'update_preferences',
  UPDATE_STATUS: 'update_status',
  UPDATE_COMPETING: 'update_competing',
  UPDATE_USER_COUNT: 'user_count',
  KICK_USER: 'kick_user',
  BAN_USER: 'ban_user',
  UNBAN_USER: 'unban_user',
  UPDATE_REGISTRATION: 'register',
  NEXT_SOLVE_AT: 'next_solve_at', // transmits an approx time to expect the new scramble
  START_ROOM: 'start',
  PAUSE_ROOM: 'pause',
  UPDATE_USER: 'update_user',
};
