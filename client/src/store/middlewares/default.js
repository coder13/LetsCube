import Protocol from '../../lib/protocol';
import Namespace from '../../lib/Namespace';
import {
  CONNECT,
  DISCONNECT,
  connectionChanged,
  connected,
  disconnected,
} from '../default/actions';
import {
  userCountUpdated,
} from '../server/actions';
import { USER_CHANGED } from '../user/actions';
import { fetchNotifications } from '../notifications/actions';
import { manager } from './manager';

const defaultNamespaceMiddleware = (store) => {
  const namespace = new Namespace({
    manager,
    namespace: '/',
    onChange: (isConnected) => {
      store.dispatch(connectionChanged(isConnected));
    },
    onConnected: () => {
      store.dispatch(connected());
      if (store.getState().user.id) {
        store.dispatch(fetchNotifications());
      }
    },
    onDisconnected: () => {
      store.dispatch(disconnected());
    },
    events: {
      [Protocol.UPDATE_USER_COUNT]: (userCount) => {
        store.dispatch(userCountUpdated(userCount));
      },
      [Protocol.NOTIFICATION_CREATED]: () => {
        store.dispatch(fetchNotifications());
      },
      [Protocol.NOTIFICATION_UPDATED]: () => {
        store.dispatch(fetchNotifications());
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
    [USER_CHANGED]: (action) => {
      if (action.user && action.user.id) {
        store.dispatch(fetchNotifications());
      }
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
