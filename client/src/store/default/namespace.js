import * as Protocol from '../../lib/protocol';
import Namespace from '../../lib/Namespace';
import {
  CONNECT,
  DISCONNECT,
  connectionChanged,
  connected,
  disconnected,
} from './actions';
import { userCountUpdated } from '../server/actions';
import { USER_CHANGED } from '../user/actions';

const defaultNamespaceMiddleware = (store) => {
  // The socket's connection state changed
  const onChange = (isConnected) => {
    store.dispatch(connectionChanged(isConnected));
  };

  const { port } = store.getState().router.location.query;

  const namespace = new Namespace({
    namespace: '/',
    port,
    onChange,
    onConnected: () => {
      store.dispatch(connected(namespace.URI));
    },
    onDisconnected: () => {
      store.dispatch(disconnected());
    },
    events: {
      [Protocol.RECONNECT]: () => {
        // eslint-disable-next-line no-console
        console.log('[SOCKET.IO] reconnected to /!');
        store.dispatch(userCountUpdated(0));
      },
      [Protocol.UPDATE_USER_COUNT]: (userCount) => {
        store.dispatch(userCountUpdated(userCount));
      },
    },
  });

  const reducers = {
    [CONNECT]: () => {
      namespace.connect();
    },
    [DISCONNECT]: () => {
      namespace.disconnect();
    },
    [USER_CHANGED]: () => {
      namespace.disconnect();
      namespace.connect();
    },
  };

  // Return the handler that will be called for each action dispatched
  return (next) => (action) => {
    if (reducers[action.type]) {
      reducers[action.type](action);
    }
    next(action); // This is a middleware, we still need to call this!
  };
};

export default defaultNamespaceMiddleware;
