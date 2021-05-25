export const USER_COUNT_UPDATED = 'server/user_count_updated';
export const UPDATE_CONNECTING = 'server/update_connecting';
export const UPDATE_CONNECTED = 'server/update_connected';
export const UPDATE_RECONNECT_ATTEMPTS = 'server/update_reconnect_attempts';
export const UPDATE_RECONNECTION_ERROR = 'server/update_reconnection_error';
export const UPDATE_RECONNECTING = 'server/update_reconnecting';
export const UPDATE_URI = 'server/update_uri';

export const userCountUpdated = (userCount) => ({
  type: USER_COUNT_UPDATED,
  userCount,
});

export const updateReconnectAttempts = (reconnectAttempts) => ({
  type: UPDATE_RECONNECT_ATTEMPTS,
  reconnectAttempts,
});

export const updateReconnectError = (reconnectError) => ({
  type: UPDATE_RECONNECTION_ERROR,
  reconnectError,
});

export const updateReconnecting = (reconnecting) => ({
  type: UPDATE_RECONNECTING,
  reconnecting,
});

export const updateURI = (URI) => ({
  type: UPDATE_URI,
  URI,
});
