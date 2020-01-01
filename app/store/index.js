import { createStore, combineReducers, applyMiddleware } from 'redux';
import thunkMiddleware from 'redux-thunk';
import { createLogger } from 'redux-logger';

import roomsReducer from './rooms/reducer';
import socketReducer from './socket/reducer';
import userReducer from './user/reducer';

import socketMiddleware from './socket/middleware';

// Root reducer
const rootReducer = combineReducers({
  roomList: roomsReducer,
  socket: socketReducer,
  user: userReducer
});

const middleware = applyMiddleware(
  thunkMiddleware,
  socketMiddleware,
  createLogger(),
)

// Store
const store = createStore(rootReducer, middleware);

export default store;