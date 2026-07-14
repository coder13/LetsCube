import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import { ConfirmProvider } from 'material-ui-confirm';
import { ThemeProvider } from '../theme';
import store from '../store';
import history from '../lib/history';
import Navigation from './Navigation';

function App() {
  return (
    <Provider store={store}>
      <Router history={history}>
        <ThemeProvider>
          <ConfirmProvider>
            <CssBaseline />
            <Navigation />
          </ConfirmProvider>
        </ThemeProvider>
      </Router>
    </Provider>
  );
}

export default App;
