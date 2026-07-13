import React, { Suspense, lazy } from 'react';
import PropTypes from 'prop-types';
import {
  Switch, Route, Redirect, useLocation,
} from 'react-router-dom';
import { connect, useDispatch } from 'react-redux';
import { push } from 'connected-react-router';
// import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import Button from '@material-ui/core/Button';
import Snackbar from '@material-ui/core/Snackbar';
import Alert from '@material-ui/lab/Alert';
import { makeStyles } from '@material-ui/core/styles';
import PrivateRoute from './common/PrivateRoute';
import Header from './Header';
import Footer from './Footer';
import WCARedirect from './WCARedirect';
import Admin from './Admin';
import { closeMessage } from '../store/messages/actions';
import { discardPendingResult } from '../store/room/actions';
import {
  canDiscardPendingResult,
  isPendingResult,
  pendingResultBelongsToUser,
} from '../store/room/resultOutbox';
import Text from './Text';

const Lobby = lazy(() => import('./Lobby/index'));
const Room = lazy(() => import('./Room/index'));
const Profile = lazy(() => import('./common/Profile'));
const Notifications = lazy(() => import('./Notifications'));

export const shouldShowGlobalPendingResult = (room, pendingResult) => (
  isPendingResult(pendingResult)
  && !(room.accessCode && room.type === 'normal' && !room.fetching)
);

export function GlobalPendingResultAlert({
  atPendingRoom,
  error,
  onDiscard,
  onReturn,
  pendingResult,
  privateRoom,
  status,
  userId,
}) {
  const belongsToUser = pendingResultBelongsToUser(pendingResult, userId);
  const canDiscardResult = canDiscardPendingResult(pendingResult, status);
  let message;

  if (!belongsToUser) {
    message = canDiscardResult
      ? 'A saved time for another account is stored on this device. Switch back to that account or discard it.'
      : 'A saved time for another account may already be submitting. Switch back to that account to finish it.';
  } else if (status === 'failed') {
    message = `Your saved time could not be submitted: ${error.message}`;
  } else if (atPendingRoom) {
    const rejoinMessage = privateRoom
      ? 'Enter the room password below to rejoin and submit it.'
      : 'Rejoin the room to submit it.';
    message = canDiscardResult
      ? `Your time is still saved on this device. ${rejoinMessage}`
      : `Your time may already be submitting. ${rejoinMessage}`;
  } else {
    message = canDiscardResult
      ? `Your saved time is waiting in room ${pendingResult.roomId}. Return there to submit it, or discard it.`
      : `Your saved time is waiting in room ${pendingResult.roomId}. Return there to finish submitting it.`;
  }

  return (
    <Alert
      severity={status === 'failed' ? 'error' : 'warning'}
      action={(
        <>
          {belongsToUser && !atPendingRoom && (
            <Button color="inherit" size="small" onClick={onReturn}>
              Return to room
            </Button>
          )}
          {canDiscardResult && (
            <Button color="inherit" size="small" onClick={onDiscard}>
              Discard saved result
            </Button>
          )}
        </>
      )}
    >
      {message}
    </Alert>
  );
}

GlobalPendingResultAlert.propTypes = {
  atPendingRoom: PropTypes.bool.isRequired,
  error: PropTypes.shape({
    message: PropTypes.string,
  }),
  onDiscard: PropTypes.func.isRequired,
  onReturn: PropTypes.func.isRequired,
  pendingResult: PropTypes.shape({
    deliveryAttempted: PropTypes.bool,
    roomId: PropTypes.string,
    submissionId: PropTypes.string,
    userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }).isRequired,
  privateRoom: PropTypes.bool,
  status: PropTypes.oneOf(['pending', 'sending', 'failed']).isRequired,
  userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

GlobalPendingResultAlert.defaultProps = {
  error: null,
  privateRoom: false,
  userId: undefined,
};

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
  room, roomList, connected, user, messages, server,
}) {
  const classes = useStyles();
  const dispatch = useDispatch();
  const location = useLocation();
  const roomConnectionInterrupted = !!room._id && !roomList.connected;
  const connectionInterrupted = room._id
    ? roomConnectionInterrupted
    : (!connected || server.reconnecting);
  const resultSubmission = room.resultSubmission || {};
  const pendingResult = resultSubmission.pendingResult;
  const showGlobalPendingResult = shouldShowGlobalPendingResult(room, pendingResult);
  const pendingRoomPath = pendingResult ? `/rooms/${pendingResult.roomId}` : null;
  const atPendingRoom = location.pathname === pendingRoomPath;

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
        {connectionInterrupted && (
          <Alert severity={roomConnectionInterrupted ? 'warning' : 'error'}>
            {roomConnectionInterrupted
              ? 'Room connection interrupted. You can finish your solve; your completed time will be saved on this device.'
              : 'Disconnected from server.'}
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
        {showGlobalPendingResult && (
          <GlobalPendingResultAlert
            atPendingRoom={atPendingRoom}
            error={resultSubmission.error}
            onDiscard={() => dispatch(discardPendingResult(pendingResult.submissionId))}
            onReturn={() => dispatch(push(pendingRoomPath))}
            pendingResult={pendingResult}
            privateRoom={!!room.private}
            status={resultSubmission.status}
            userId={user.id}
          />
        )}
        <main className={classes.content}>
          <Suspense fallback={Loading}>
            {!user.fetching && (
              <Switch>
                <Route exact path="/" component={Lobby} />
                { (!user.id || user.canJoinRoom) && <Route path="/rooms/:roomId" component={Room} /> }
                <PrivateRoute exact path="/profile" component={Profile} user={user} />
                <PrivateRoute exact path="/notifications" component={Notifications} user={user} />
                <PrivateRoute path="/admin" isAdminRoute component={Admin} />
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
    accessCode: PropTypes.string,
    fetching: PropTypes.bool,
    type: PropTypes.string,
    resultSubmission: PropTypes.shape({
      status: PropTypes.oneOf(['idle', 'pending', 'sending', 'failed']),
      pendingResult: PropTypes.shape({
        deliveryAttempted: PropTypes.bool,
        roomId: PropTypes.string,
        submissionId: PropTypes.string,
      }),
      error: PropTypes.shape({
        message: PropTypes.string,
      }),
    }),
  }),
  roomList: PropTypes.shape({
    connected: PropTypes.bool,
  }),
  server: PropTypes.shape({
    reconnecting: PropTypes.bool,
    reconnectAttempts: PropTypes.number,
    reconnectError: PropTypes.shape({
      message: PropTypes.string,
    }),
  }),
};

Navigation.defaultProps = {
  connected: false,
  messages: [],
  room: {
    id: undefined,
  },
  roomList: {
    connected: false,
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
  roomList: state.roomList,
});

export default connect(mapStateToProps)(Navigation);
