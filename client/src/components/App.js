import React from 'react';
import { AppContainer } from 'react-hot-loader';
import { Provider } from 'react-redux';
import { ConnectedRouter } from 'connected-react-router';
import CssBaseline from '@material-ui/core/CssBaseline';
import { ConfirmProvider } from 'material-ui-confirm';
import { ThemeProvider } from '../theme';
import { store, history } from '../store';
import Navigation from './Navigation';

function App() {
  return (
    <AppContainer>
      <Provider store={store}>
        <ConnectedRouter history={history} noInitialPop>
          <ConfirmProvider>
            <ThemeProvider>
              <CssBaseline />
              <Navigation />
            </ThemeProvider>
          </ConfirmProvider>
        </ConnectedRouter>
      </Provider>
    </AppContainer>
  );
}

export default App;
