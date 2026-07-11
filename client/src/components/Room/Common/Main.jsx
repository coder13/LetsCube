import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Divider from '@material-ui/core/Divider';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import ClickAwayListener from '@material-ui/core/ClickAwayListener';
import Alert from '@material-ui/lab/Alert';
import { Cube } from 'react-cube-svg';
import UIfx from 'uifx';
import { push } from 'connected-react-router';
import notificationAsset from '../../../assets/notification.mp3';
import calcStats from '../../../lib/stats';
import {
  submitResult,
  discardPendingResult,
  sendStatus,
  timerFocused,
} from '../../../store/room/actions';
import {
  canDiscardPendingResult,
  isPendingResult,
  pendingResultBelongsToUser,
  pendingResultMatches,
} from '../../../store/room/resultOutbox';
import { StatsDialogProvider } from './StatsDialogProvider';
import { EditDialogProvider } from './EditDialogProvider';
import TimesTable from './TimesTable';
import HelpPopover from '../../common/HelpPopover';
import Timer from '../../Timer/index';
import Scramble from '../../common/Scramble';
import UserStats from './UserStats';

const useStyles = withStyles((theme) => ({
  root: {
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
    padding: theme.spacing(0),
    borderRadius: 0,
    height: '100%',
  },
  waitingForBox: {
    padding: '.5em',
  },
  submissionAlert: {
    borderRadius: 0,
  },
  scrambleBox: {
    padding: '.5em',
    textAlign: 'center',
    justifyContent: 'center',
    width: '80%',
    margin: 'auto',
  },
}));

export class Main extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      currentAttempt: undefined,
    };
  }

  componentDidUpdate(prevProps) {
    const { room, user } = this.props;
    const attemptsUpdated = room.attempts.length > prevProps.room.attempts.length;
    if (!user.muteTimer && attemptsUpdated) {
      const notification = new UIfx(
        notificationAsset,
        { volume: 0.2 },
      );
      notification.play();
    }
  }

  onSubmitTime(event) {
    const { dispatch, room, user } = this.props;
    const { currentAttempt } = this.state;

    if (!room.attempts.length) {
      return;
    }

    if (!user.id) {
      return;
    }

    const latestAttempt = room.attempts ? room.attempts[room.attempts.length - 1] : {};
    const submittedAttempt = currentAttempt || latestAttempt;
    dispatch(submitResult({
      id: submittedAttempt.id,
      attemptKey: submittedAttempt._id,
      result: {
        time: event.time,
        penalties: event.penalties,
      },
    }));
    this.setState({ currentAttempt: null });
  }

  onTimerFocused = () => {
    const { dispatch } = this.props;
    dispatch(timerFocused(true));
  };

  onTimerDefocused = () => {
    const { dispatch } = this.props;
    dispatch(timerFocused(false));
  };

  handleStatusChange(status) {
    const { dispatch } = this.props;
    dispatch(sendStatus(status));
  }

  handlePriming() {
    const { room } = this.props;
    const latestAttempt = room.attempts ? room.attempts[room.attempts.length - 1] : {};
    this.setState({ currentAttempt: latestAttempt });
  }

  render() {
    const {
      classes, dispatch, room, user, onlyShowSelf, roomConnected,
    } = this.props;

    const {
      users, attempts, waitingFor,
    } = room;
    const resultSubmission = room.resultSubmission || {};
    const pendingResult = resultSubmission.pendingResult;
    const hasPendingResult = isPendingResult(pendingResult);
    const canDiscardResult = canDiscardPendingResult(
      pendingResult,
      resultSubmission.status,
    );
    const pendingBelongsToUser = pendingResultBelongsToUser(pendingResult, user.id);
    const pendingMatchesRoom = pendingResultMatches(pendingResult, {
      userId: user.id,
      roomId: room._id,
    });
    const latestAttempt = (attempts && attempts.length) ? attempts[attempts.length - 1] : {};
    const timerDisabled = !room.timerFocused || !room.competing[user.id]
      || !room.waitingFor[user.id] || hasPendingResult;
    const hidden = room.competing[user.id] && !waitingFor[user.id];

    let submissionMessage = '';
    if (!pendingBelongsToUser) {
      submissionMessage = canDiscardResult
        ? 'A saved time for another account is stored on this device. Switch back to that account or discard it before timing another solve.'
        : 'A saved time for another account may already be submitting. Switch back to that account to finish it.';
    } else if (!pendingMatchesRoom) {
      submissionMessage = canDiscardResult
        ? `Your saved time belongs to room ${pendingResult.roomId}. Return there to submit it, or discard it before timing another solve.`
        : `Your saved time belongs to room ${pendingResult.roomId}. Return there to finish submitting it.`;
    } else if (resultSubmission.status === 'failed') {
      submissionMessage = `Your saved time could not be submitted: ${resultSubmission.error.message}`;
    } else if (resultSubmission.status === 'sending') {
      submissionMessage = 'Submitting your saved time...';
    } else if (roomConnected) {
      submissionMessage = 'Your time is saved on this device and waiting to submit.';
    } else {
      submissionMessage = 'Your time is saved on this device. It will submit after the room reconnects.';
    }

    const stats = calcStats(attempts, users);
    const showScramble = latestAttempt.scrambles && room.event === '333';

    return (
      <ClickAwayListener onClickAway={() => { this.onTimerDefocused(); }}>
        <Paper className={classes.root} variant="outlined" square onClick={() => { this.onTimerFocused(); }}>
          {hasPendingResult && (
            <Alert
              className={classes.submissionAlert}
              severity={resultSubmission.status === 'failed' ? 'error' : 'warning'}
              action={(
                <>
                  {pendingBelongsToUser && !pendingMatchesRoom && (
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => dispatch(push(`/rooms/${pendingResult.roomId}`))}
                    >
                      Return to room
                    </Button>
                  )}
                  {canDiscardResult && (
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => dispatch(discardPendingResult(pendingResult.submissionId))}
                    >
                      Discard saved result
                    </Button>
                  )}
                </>
              )}
            >
              {submissionMessage}
            </Alert>
          )}
          <StatsDialogProvider>
            <EditDialogProvider dispatch={dispatch}>
              <div className={classes.scrambleBox}>
                { hidden ? (
                  <Typography variant="h6" style={{ fontWeight: 400 }}>
                    Waiting for other solvers...
                  </Typography>
                ) : (
                  <Scramble
                    event={room.event}
                    disabled={timerDisabled}
                    scrambles={latestAttempt.scrambles}
                  />
                )}
              </div>
              <Divider />
              <div>
                <HelpPopover />
                {room.competing[user.id] && (
                  <Timer
                    disabled={timerDisabled}
                    onSubmitTime={(e) => this.onSubmitTime(e)}
                    onStatusChange={(status) => { this.handleStatusChange(status); }}
                    useInspection={user.useInspection}
                    onPriming={() => { this.handlePriming(); }}
                    type={user.timerType}
                  />
                )}
              </div>
              <Divider />
              { onlyShowSelf
                ? (
                  <TimesTable
                    room={room}
                    stats={stats}
                    userId={user.id}
                    userFilter={(u) => +u.id === +user.id}
                  />
                )
                : <TimesTable room={room} stats={stats} userId={user.id} />}
              <Grid container>
                <Grid item xs={showScramble ? 10 : 12} sm={showScramble ? 9 : 12}>
                  <UserStats stats={stats[user.id]} />
                  <Paper
                    className={classes.waitingForBox}
                    square
                    variant="outlined"
                  >
                    <Typography variant="body2">
                      Waiting For:
                      {' '}
                      { Object.keys(waitingFor)
                        .filter((userId) => waitingFor[userId])
                        .map((userId) => users.find((u) => +u.id === +userId))
                        .filter((u) => !!u)
                        .map((u) => u.displayName)
                        .join(', ')}
                    </Typography>
                  </Paper>
                </Grid>
                {showScramble && (
                  <Grid item xs={2} sm={3}>
                    <Paper
                      square
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '100%',
                      }}
                      variant="outlined"
                    >
                      <Cube
                        size={120}
                        scramble={latestAttempt.scrambles ? latestAttempt.scrambles[0] : ''}
                      />
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </EditDialogProvider>
          </StatsDialogProvider>
        </Paper>
      </ClickAwayListener>
    );
  }
}

Main.propTypes = {
  room: PropTypes.shape({
    _id: PropTypes.string,
    private: PropTypes.bool,
    accessCode: PropTypes.string,
    event: PropTypes.string,
    users: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.number,
    })),
    competing: PropTypes.shape(),
    waitingFor: PropTypes.shape(),
    statuses: PropTypes.shape(),
    attempts: PropTypes.arrayOf(PropTypes.shape({
      _id: PropTypes.string,
      id: PropTypes.number,
    })),
    admin: PropTypes.shape({
      id: PropTypes.number,
    }),
    timerFocused: PropTypes.bool,
    resultSubmission: PropTypes.shape({
      status: PropTypes.oneOf(['idle', 'pending', 'sending', 'failed']),
      pendingResult: PropTypes.shape({
        deliveryAttempted: PropTypes.bool,
        submissionId: PropTypes.string,
      }),
      error: PropTypes.shape({
        message: PropTypes.string,
      }),
    }),
  }),
  user: PropTypes.shape({
    id: PropTypes.number,
    useInspection: PropTypes.bool,
    muteTimer: PropTypes.bool,
    timerType: PropTypes.string,
  }),
  dispatch: PropTypes.func.isRequired,
  classes: PropTypes.shape().isRequired,
  onlyShowSelf: PropTypes.bool,
  roomConnected: PropTypes.bool,
};

Main.defaultProps = {
  room: {
    _id: undefined,
    private: false,
    accessCode: undefined,
    event: '333',
    users: [],
    competing: {},
    waitingFor: {},
    statues: {},
    attempts: [],
    admin: {
      id: undefined,
    },
    timerFocused: true,
    resultSubmission: {
      status: 'idle',
      pendingResult: null,
      error: null,
    },
  },
  user: {
    id: undefined,
    useInspection: false,
    muteTimer: false,
    timerType: 'spacebar',
  },
  onlyShowSelf: false,
  roomConnected: false,
};

const mapStateToProps = (state) => ({
  room: state.room,
  roomConnected: state.roomList.connected,
  user: state.user,
});

export default connect(mapStateToProps)(useStyles(Main));
