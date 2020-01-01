export const CONNECTION_CHANGED = 'socket/connection-changed';
export const CONNECT_SOCKET     = 'socket/connect';
export const DISCONNECT_SOCKET  = 'socket/disconnect';

// The socket's connection state changed
export const connectionChanged = isConnected => ({
  type: CONNECTION_CHANGED,
  connected: isConnected,
  isError: false
});

// Main action to connect to socket
export const connectSocket = (user, port) => ({
  type: CONNECT_SOCKET
});

export const disconnectSocket = () => ({
  type: DISCONNECT_SOCKET
});