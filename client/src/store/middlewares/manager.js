import qs from 'qs';
import { Manager } from 'socket.io-client';
import {
  updateReconnectAttempts,
  updateReconnectError,
  updateReconnecting,
} from '../server/actions';

export const CONNECT = 'manager/connect';

const queryParams = qs.parse(window.location.search, { ignoreQueryPrefix: true });
const port = queryParams.port || 9000;
export const URI = `${process.env.REACT_APP_SOCKETIO_ORIGIN}:${port}`;

export const manager = new Manager(URI, {
  withCredentials: true,
});

export const socketIOManagerMiddleware = (store) => {
  manager.on('reconnect_attempt', (attempt) => {
    store.dispatch(updateReconnectAttempts(attempt));
  });

  manager.on('reconnect_error', (error) => {
    store.dispatch(updateReconnectError(error));
  });

  manager.on('reconnect', () => {
    store.dispatch(updateReconnecting(false));
  });

  const reducers = {};

  return (next) => (action) => {
    if (reducers[action.type]) {
      reducers[action.type](action);
    }
    next(action);
  };
};
