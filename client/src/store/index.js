import {
  createStore, compose, combineReducers, applyMiddleware,
} from 'redux';
import thunkMiddleware from 'redux-thunk';
import ReactGA from 'react-ga';
import { connectRouter, routerMiddleware } from 'connected-react-router';
import history from '../lib/history';

import roomsReducer from './rooms/reducer';
import roomReducer from './room/reducer';
import socketReducer from './default/reducer';
import userReducer from './user/reducer';
import messageReducer from './messages/reducers';
import chatReducer from './chat/reducer';
import serverReducer from './server/reducers';
import adminReducer from './admin/reducers';

import roomNamespaceMiddleware from './middlewares/rooms';
import defaultNamespaceMiddleware from './middlewares/default';

const composeEnhancer = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

if (process.env.NODE_ENV === 'production') {
  ReactGA.initialize('UA-143761187-3', {
    debug: false,
  });
}

const trackPage = (page) => {
  ReactGA.pageview(page);
};

const gaTrackingMiddleware = () => (next) => (action) => {
  if (action.type === '@@router/LOCATION_CHANGE') {
    const nextPage = `${action.payload.location.pathname}${action.payload.location.search}`;
    trackPage(nextPage);
  }
  return next(action);
};

// Root reducer
const rootReducer = combineReducers({
  router: connectRouter(history),
  roomList: roomsReducer,
  room: roomReducer,
  socket: socketReducer,
  user: userReducer,
  messages: messageReducer,
  chat: chatReducer,
  server: serverReducer,
  admin: adminReducer,
});

const middlewares = [
  routerMiddleware(history),
  thunkMiddleware,
  defaultNamespaceMiddleware,
  roomNamespaceMiddleware,
];

if (process.env.NODE_ENV === 'production') {
  middlewares.push(gaTrackingMiddleware);
}

const middleware = applyMiddleware(...middlewares);

// Store
export default createStore(rootReducer, composeEnhancer(middleware));
