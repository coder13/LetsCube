import {
  createStore, compose, combineReducers, applyMiddleware,
} from 'redux';
import thunkMiddleware from 'redux-thunk';
import ReactGA from 'react-ga';
import { connectRouter, routerMiddleware } from 'connected-react-router';
import { createBrowserHistory } from 'history';

import roomsReducer from './rooms/reducer';
import roomReducer from './room/reducer';
import socketReducer from './socket/reducer';
import userReducer from './user/reducer';
import messageReducer from './messages/reducers';
import chatReducer from './chat/reducer';
// import serverReducer from './server/reducers';

import socketMiddleware from './socket/middleware';

const composeEnhancer = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

export const history = createBrowserHistory();

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
});

const middlewares = [
  routerMiddleware(history),
  thunkMiddleware,
  socketMiddleware,
];

if (process.env.NODE_ENV === 'production') {
  middlewares.push(gaTrackingMiddleware);
}

const middleware = applyMiddleware(...middlewares);

// Store
export const store = createStore(rootReducer, composeEnhancer(middleware));
