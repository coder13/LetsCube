import React, { Suspense, lazy } from 'react';
import PropTypes from 'prop-types';
import { Switch, Route, Redirect } from 'react-router-dom';
import { connect, useDispatch } from 'react-redux';
// import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import Snackbar from '@material-ui/core/Snackbar';
import Alert from '@material-ui/lab/Alert';
import { makeStyles } from '@material-ui/core/styles';
import PrivateRoute from './common/PrivateRoute';
import Header from './Header';
import Footer from './Footer';
import WCARedirect from './WCARedirect';
import Admin from './Admin';
import { closeMessage } from '../store/messages/actions';
import Text from './Text';

const RoomList = lazy(() => import('./RoomList'));
const Room = lazy(() => import('./Room/index'));
const Profile = lazy(() => import('./common/Profile'));

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    height: '100vh',
    flexDirection: 'column',
    '-webkit-user-select': 'none',
    '-webkit-touch-callout': 'none',
    '-moz-user-select': 'none',
    '-ms-user-select': 'none',
    'user-select': 'none',
  },
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
  },
  content: {
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
  },
}));

function Navigation({
  room, connected, user, messages, server,
}) {
  const classes = useStyles();
  const dispatch = useDispatch();

  const handleClose = (index, event, reason) => {
    if (reason === 'clickaway') {
      return;
    }

    dispatch(closeMessage(index));
  };

  const Loading = (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
      }}
    >
      <CircularProgress color="inherit" />
    </div>
  );

  return (
    <div className={classes.root}>
      {/* <Backdrop className={classes.backdrop} open={!connected}>
        <CircularProgress color="inherit" />
        <Snackbar open anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        </Snackbar>
      </Backdrop> */}

      <div className={classes.container}>
        <Header />
        {!connected && (
          <Alert severity="error">
            Disconnected from server.
            { (server.reconnecting || server.reconnectAttempts > 0) && (
              ` Reconnecting...${server.reconnectAttempts} attempts`
            )}
            { server.reconnectError && (
              <p>
                <Text as="p">
                  Error:
                  {' '}
                  {server.reconnectError.message}
                </Text>
              </p>
            )}
          </Alert>
        )}
        <main className={classes.content}>
          <Suspense fallback={Loading}>
            {!user.fetching && (
              <Switch>
                <Route exact path="/" component={RoomList} />
                { (!user.id || user.canJoinRoom) && <Route path="/rooms/:roomId" component={Room} /> }
                <PrivateRoute exact path="/profile" component={Profile} user={user} />
                <PrivateRoute path="/admin" isCalebRoute component={Admin} />
                <Route path="/wca-redirect" component={WCARedirect} />
                <Redirect to="/" />
              </Switch>
            )}
          </Suspense>
        </main>
        { !room._id && <Footer /> }
      </div>

      {messages[0] ? (
        <Snackbar
          open={!!messages[0]}
          autoHideDuration={3000}
          onClose={(event, reason) => handleClose(0, event, reason)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Alert
            onClose={(event, reason) => handleClose(0, event, reason)}
            severity={messages[0].severity}
          >
            {messages[0].text}
          </Alert>
        </Snackbar>
      )
        : ''}
    </div>
  );
}

Navigation.propTypes = {
  connected: PropTypes.bool,
  user: PropTypes.shape().isRequired,
  messages: PropTypes.arrayOf(PropTypes.shape({
    severity: PropTypes.string,
    text: PropTypes.string,
  })),
  room: PropTypes.shape({
    _id: PropTypes.string,
  }),
  server: PropTypes.shape({
    reconnecting: PropTypes.bool,
    reconnectAttempts: PropTypes.number,
    reconnectError: PropTypes.object,
  }),
};

Navigation.defaultProps = {
  connected: false,
  messages: [],
  room: {
    id: undefined,
  },
  server: {
    reconnecting: false,
    reconnectAttempts: 0,
    reconnectError: undefined,
  },
};

const mapStateToProps = (state) => ({
  connected: state.socket.connected,
  server: state.server,
  user: state.user,
  messages: state.messages.messages,
  room: state.room,
});

export default connect(mapStateToProps)(Navigation);
