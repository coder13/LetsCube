import React from 'react';
import PropTypes from 'prop-types';
import { Switch, Route, Redirect } from 'react-router-dom';
import { connect } from 'react-redux';
import Container from '@material-ui/core/Container';
import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import Snackbar from '@material-ui/core/Snackbar';
import Alert from '@material-ui/lab/Alert';
import { makeStyles } from '@material-ui/core/styles';
import Header from './Header';
import RoomList from './RoomList';
import Room from './Room';
import { closeMessage } from '../store/messages/actions';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    minHeight: '100vh',
    flexDirection: 'column',
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

function Preferences() {
  return (
    <Container>
      <h1>Prefs!</h1>
    </Container>
  );
}

function App({
  connected, user, room, messages,
}) {
  const classes = useStyles();

  const handleClose = (index, event, reason) => {
    if (reason === 'clickaway') {
      return;
    }

    closeMessage(index);
  };

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

      <Header user={user} room={room}>
        <Switch>
          <Route exact path="/" component={RoomList} />
          <Route path="/rooms/:roomId" component={Room} />
          {user
            && (<Route exact path="/preferences" component={Preferences} />)}
          <Redirect to="/" />
        </Switch>
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
  room: PropTypes.shape().isRequired,
  messages: PropTypes.arrayOf(PropTypes.shape({
    severity: PropTypes.string,
    text: PropTypes.string,
  })),
};

App.defaultProps = {
  connected: false,
  messages: [],
};

const mapStateToProps = (state) => ({
  connected: state.socket.connected,
  room: state.room,
  user: state.user,
  messages: state.messages.messages,
});

const mapDispatchToProps = (dispatch) => ({
  closeMessage: (message) => dispatch(closeMessage(message)),
});

export default connect(mapStateToProps, mapDispatchToProps)(App);
