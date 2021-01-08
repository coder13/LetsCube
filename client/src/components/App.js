import React from 'react';
import { AppContainer } from 'react-hot-loader';
import { Provider } from 'react-redux';
import { ConnectedRouter } from 'connected-react-router';
import CssBaseline from '@material-ui/core/CssBaseline';
import { ConfirmProvider } from 'material-ui-confirm';
import { ThemeProvider } from '../theme';
import store from '../store';
import history from '../lib/history';
import Navigation from './Navigation';

function App() {
  return (
    <AppContainer>
      <Provider store={store}>
        <ConnectedRouter history={history} noInitialPop>
          <ThemeProvider>
            <ConfirmProvider>
              <CssBaseline />
              <Navigation />
            </ConfirmProvider>
          </ThemeProvider>
        </ConnectedRouter>
      </Provider>
    </AppContainer>
  );
}

export default App;
