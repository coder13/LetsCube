import { createStore, combineReducers, applyMiddleware } from 'redux';

// REDUCERS
import socketReducer from './socket/reducer';

// MIDDLEWARE
import socketMiddleware from './socket/middleware';

// Root reducer
const rootReducer = combineReducers({
  socket: socketReducer
});

// Store
const store = createStore(
  rootReducer,
  applyMiddleware(socketMiddleware));

export default store;