import { createStore, compose, combineReducers, applyMiddleware } from 'redux';
import thunkMiddleware from 'redux-thunk';
import { createLogger } from 'redux-logger';
import { connectRouter, routerMiddleware } from 'connected-react-router';
import { createBrowserHistory } from 'history'

import roomsReducer from './rooms/reducer';
import roomReducer from './room/reducer';
import socketReducer from './socket/reducer';
import userReducer from './user/reducer';
import messageReducer from './messages/reducers';

import socketMiddleware from './socket/middleware';

const composeEnhancer = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

export const history = createBrowserHistory();

// Root reducer
const rootReducer = combineReducers({
  router: connectRouter(history),
  roomList: roomsReducer,
  room: roomReducer,
  socket: socketReducer,
  user: userReducer,
  messages: messageReducer
});

const middleware = applyMiddleware(
  routerMiddleware(history),
  thunkMiddleware,
  socketMiddleware,
  createLogger(),
)

// Store
export const store = createStore(rootReducer, composeEnhancer(middleware));