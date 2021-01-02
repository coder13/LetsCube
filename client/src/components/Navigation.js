import React, { Suspense, lazy } from 'react';
import PropTypes from 'prop-types';
import { Switch, Route, Redirect } from 'react-router-dom';
import { connect } from 'react-redux';
import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import Snackbar from '@material-ui/core/Snackbar';
import Alert from '@material-ui/lab/Alert';
import { makeStyles } from '@material-ui/core/styles';
import Header from './Header';
// import RoomList from './RoomList';
// import Room from './Room/index';
// import Profile from './Profile';
import { closeMessage } from '../store/messages/actions';

const RoomList = lazy(() => import('./RoomList'));
const Room = lazy(() => import('./Room/index'));
const Profile = lazy(() => import('./Profile'));

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
  backdropContainer: {
    textAlign: 'center',
    verticalAlign: 'middle',
  },
  drawerHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 1),
    // necessary for content to be below app bar
    ...theme.mixins.toolbar,
    justifyContent: 'flex-end',
  },
}));

function App({
  dispatch, connected, user, messages,
}) {
  const classes = useStyles();

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
      <Backdrop className={classes.backdrop} open={!connected}>
        <CircularProgress color="inherit" />
        <Snackbar open anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert severity="error">
            Disconnected from server.
          </Alert>
        </Snackbar>
      </Backdrop>

      <Header>
        <Suspense fallback={Loading}>
          <Switch>
            <Route exact path="/" component={RoomList} />
            { (!user.id || user.canJoinRoom) && <Route path="/rooms/:roomId" component={Room} /> }
            { (user.id || user.fetching)
              && (<Route exact path="/profile" component={Profile} user={user} />)}
            <Redirect to="/" />
          </Switch>
        </Suspense>
      </Header>

      {messages[0] ? (
        <Snackbar
          open={!!messages[0]}
          autoHideDuration={6000}
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

App.propTypes = {
  connected: PropTypes.bool,
  user: PropTypes.shape().isRequired,
  messages: PropTypes.arrayOf(PropTypes.shape({
    severity: PropTypes.string,
    text: PropTypes.string,
  })),
  dispatch: PropTypes.func.isRequired,
};

App.defaultProps = {
  connected: false,
  messages: [],
};

const mapStateToProps = (state) => ({
  connected: state.socket.connected,
  user: state.user,
});

export default connect(mapStateToProps)(App);
