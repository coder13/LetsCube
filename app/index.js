import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { ConnectedRouter } from 'connected-react-router';
import CssBaseline from '@material-ui/core/CssBaseline';
import { ThemeProvider } from '@material-ui/core/styles';
import './css/index.scss';
import App from './components/App';
import * as serviceWorker from './serviceWorker';
import theme from './theme';
import { store, history } from './store';
import { connectSocket } from './store/socket/actions';
import { fetchUser } from './store/user/actions';

store.dispatch(connectSocket());
store.dispatch(fetchUser());

/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */
ReactDOM.render(
  <Provider store={store}>
    <ConnectedRouter history={history}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </ConnectedRouter>
  </Provider>,
  document.querySelector('#root'),
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
