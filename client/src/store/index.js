import {
  createStore, compose, combineReducers, applyMiddleware,
} from 'redux';
import thunkMiddleware from 'redux-thunk';
import ReactGA from 'react-ga4';
import history from '../lib/history';

import roomsReducer from './rooms/reducer';
import roomReducer from './room/reducer';
import socketReducer from './default/reducer';
import userReducer from './user/reducer';
import messageReducer from './messages/reducers';
import chatReducer from './chat/reducer';
import serverReducer from './server/reducers';
import adminReducer from './admin/reducers';
import notificationsReducer from './notifications/reducer';

import roomNamespaceMiddleware from './middlewares/rooms';
import defaultNamespaceMiddleware from './middlewares/default';
import { socketIOManagerMiddleware } from './middlewares/manager';

const composeEnhancer = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

if (process.env.NODE_ENV === 'production') {
  ReactGA.initialize('G-RZQ3J1CF6Q');
}

const trackPage = (page) => {
  ReactGA.send({ hitType: 'pageview', page });
};

const handleLocationChange = (location) => {
  if (location.pathname === '/' || location.pathname === '/profile') {
    document.title = 'Let\'s Cube';
  }

  if (process.env.NODE_ENV === 'production') {
    // Query strings can contain a temporary WCA OAuth authorization code.
    trackPage(location.pathname);
  }
};

handleLocationChange(history.location);
history.listen(handleLocationChange);

// Root reducer
const rootReducer = combineReducers({
  roomList: roomsReducer,
  room: roomReducer,
  socket: socketReducer,
  user: userReducer,
  messages: messageReducer,
  chat: chatReducer,
  server: serverReducer,
  admin: adminReducer,
  notifications: notificationsReducer,
});

const middlewares = [
  thunkMiddleware,
  socketIOManagerMiddleware,
  defaultNamespaceMiddleware,
  roomNamespaceMiddleware,
];

const middleware = applyMiddleware(...middlewares);

// Store
export default createStore(rootReducer, composeEnhancer(middleware));
