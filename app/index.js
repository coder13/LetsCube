import React from 'react';
import ReactDOM from 'react-dom';
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
import { fetchUser } from './store/user/actions';
import { fetchRooms } from './store/rooms/actions';

store.dispatch(connectSocket());
store.dispatch(fetchUser());
// store.dispatch(fetchRooms());

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
