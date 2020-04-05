export const CONNECTION_CHANGED = 'socket/connection-changed';
export const CONNECT_SOCKET     = 'socket/connect';
export const CONNECTED          = 'socket/connected';
export const DISCONNECTED       = 'socket/disconnected';
export const DISCONNECT_SOCKET  = 'socket/disconnect';
export const SOCKET_JOIN_ROOM   = 'socket/join_room';
export const LOGIN_FAILED       = 'socket/login_failed';

// The socket's connection state changed
export const connectionChanged = isConnected => ({
  type: CONNECTION_CHANGED,
  connected: isConnected,
  isError: false
});

// Main action to connect to socket
export const connectSocket = () => ({
  type: CONNECT_SOCKET
});

export const disconnectSocket = () => ({
  type: DISCONNECT_SOCKET
});

export const roomJoined = room => ({
  type: SOCKET_JOIN_ROOM,
  room
});

export const connected = () => ({
  type: CONNECTED,
  connected: true
});

export const disconnected = () => ({
  type: DISCONNECTED,
  connected: false
});

export const loginFailed = (error) => ({
  type: LOGIN_FAILED,
  error
})