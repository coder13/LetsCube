import React from 'react';
import { AppContainer } from 'react-hot-loader';
import { Provider } from 'react-redux';
import { ConnectedRouter } from 'connected-react-router';
import { ThemeProvider } from '@material-ui/core/styles';
import CssBaseline from '@material-ui/core/CssBaseline';
import theme from '../theme';
import { store, history } from '../store';
import Navigation from './Navigation';

function App() {
  return (
    <AppContainer>
      <Provider store={store}>
        <ConnectedRouter history={history} noInitialPop>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <Navigation />
          </ThemeProvider>
        </ConnectedRouter>
      </Provider>
    </AppContainer>
  );
}

export default App;
