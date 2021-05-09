export const CONNECTION_CHANGED = 'default/connection-changed';
export const CONNECT = 'default/connect';
export const CONNECTED = 'default/connected';
export const DISCONNECTED = 'default/disconnected';
export const DISCONNECT = 'default/disconnect';
export const USER_COUNT_UPDATED = 'default/user_count_updated';

export const connectionChanged = (isConnected) => ({
  type: CONNECTION_CHANGED,
  connected: isConnected,
  isError: false,
});

export const connectSocket = () => ({
  type: CONNECT,
});

export const disconnectSocket = () => ({
  type: DISCONNECT,
});

export const connected = () => ({
  type: CONNECTED,
  connected: true,
});

export const disconnected = () => ({
  type: DISCONNECTED,
  connected: false,
});
