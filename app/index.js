import React from 'react';
import ReactDOM from 'react-dom';
import './css/index.css';
import App from './components/App';
import * as serviceWorker from './serviceWorker';
import { store } from './store';
import { connectSocket } from './store/socket/actions';
import { fetchUser } from './store/user/actions';

store.dispatch(connectSocket());
store.dispatch(fetchUser());

const render = () => {
  /* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */
  ReactDOM.render(
    <App />,
    document.querySelector('#root'),
  );
};

render();

if (module.hot) {
  module.hot.accept('./components/App', () => {
    render();
  });
}

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
