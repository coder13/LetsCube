// socket.io event names
module.exports = {
  MESSAGE       : 'message',
  CONNECT       : 'connect',
  DISCONNECT    : 'disconnect',
  CONNECT_ERR   : 'connect_error',
  RECONNECT_ERR : 'reconnect_error',
  ERROR         : 'error',
  UPDATE_ROOMS  : 'update_rooms',
  UPDATE_ROOM   : 'update_room',
  CREATE_ROOM   : 'create_room',
  ROOM_CREATED  : 'room_created',
  FETCH_ROOM    : 'fetch_room',
};