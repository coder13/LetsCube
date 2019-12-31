import React from 'react';
import ReactDOM from 'react-dom';
import { createStore } from 'redux';
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import CssBaseline from '@material-ui/core/CssBaseline';
import { ThemeProvider } from '@material-ui/core/styles';
import './css/index.scss';
import App from './components/App';
import * as serviceWorker from './serviceWorker';
import theme from './theme';
import store from './store';
import { connectSocket } from './store/socket/actions';

console.log(15, store)
store.dispatch(connectSocket());
// store.dispatch(fetchUser());

// const socket = require('socket.io-client')('http://localhost:9000');

// socket.on('connect', function () {
//   store.dispatch(socketConnected())
//   console.log(13, 'connected');
//   socket.emit('foo', 'bar')
// })

// socket.on('event', function () {
//   console.log(17, 'evented');
// })

// socket.on('disconnect', function () {
//   store.dispatch(socketDisconnected)
//   console.log(21, 'disconnected');
// })

// socket.on('ROOM_CREATED', data => {
//   console.log('ROOM_CREATED', data);
// })

/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */
ReactDOM.render(
  <Provider store={store}>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </Provider>,
  document.querySelector('#root'),
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
