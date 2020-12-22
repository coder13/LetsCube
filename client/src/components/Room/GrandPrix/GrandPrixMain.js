import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Divider from '@material-ui/core/Divider';
import Typography from '@material-ui/core/Typography';
import ClickAwayListener from '@material-ui/core/ClickAwayListener';
import grey from '@material-ui/core/colors/grey';
import { Cube } from 'react-cube-svg';
import UIfx from 'uifx';
import notificationAsset from '../../../assets/notification.mp3';
import calcStats from '../../../lib/stats';
import {
  submitResult,
  sendStatus,
  timerFocused,
} from '../../../store/room/actions';
import { StatsDialogProvider } from '../Common/StatsDialogProvider';
import { EditDialogProvider } from '../Common/EditDialogProvider';
import TimesTable from '../Common/TimesTable';
import HelpPopover from '../../HelpPopover';
import Timer from '../../Timer/index';
import Scramble from '../../Scramble';
import UserStats from '../Common/UserStats';

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
  scrambleBox: {
    padding: '.5em',
    textAlign: 'center',
    justifyContent: 'center',
  },
}));

class Main extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      currentAttemptId: undefined,
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
    const { currentAttemptId } = this.state;

    if (!room.attempts.length) {
      return;
    }

    // Don't even bother sending the result.
    if (!user.id) {
      return;
    }

    const latestAttempt = room.attempts ? room.attempts[room.attempts.length - 1] : {};
    dispatch(submitResult({
      id: currentAttemptId || latestAttempt.id,
      result: {
        time: event.time,
        penalties: event.penalties,
      },
    }));
    this.setState({ currentAttemptId: null });
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
    this.setState({ currentAttemptId: latestAttempt.id });
  }

  render() {
    const {
      classes, dispatch, room, user, onlyShowSelf,
    } = this.props;

    const {
      users, attempts, waitingFor,
    } = room;
    const latestAttempt = (attempts && attempts.length) ? attempts[attempts.length - 1] : {};
    const timerDisabled = !room.timerFocused || !room.competing[user.id]
      || room.waitingFor.indexOf(user.id) === -1;
    const hidden = room.competing[user.id] && waitingFor.indexOf(user.id) === -1;

    const stats = calcStats(attempts, users);
    const showScramble = latestAttempt.scrambles && room.event === '333';

    return (
      <ClickAwayListener onClickAway={() => { this.onTimerDefocused(); }}>
        <Paper className={classes.root} variant="outlined" square onClick={() => { this.onTimerFocused(); }}>
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
                {showScramble && (
                  <Grid item xs={12}>
                    <Paper
                      square
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '100%',
                        backgroundColor: grey[100],
                      }}
                      variant="outlined"
                    >
                      <Cube
                        size={240}
                        scramble={latestAttempt.scrambles ? latestAttempt.scrambles[0] : ''}
                      />
                    </Paper>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <UserStats stats={stats[user.id]} />
                </Grid>
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
    waitingFor: PropTypes.array,
    statuses: PropTypes.shape(),
    attempts: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.number,
    })),
    admin: PropTypes.shape({
      id: PropTypes.number,
    }),
    timerFocused: PropTypes.bool,
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
};

Main.defaultProps = {
  room: {
    _id: undefined,
    private: false,
    accessCode: undefined,
    event: '333',
    users: [],
    competing: {},
    waitingFor: [],
    statues: {},
    attempts: [],
    admin: {
      id: undefined,
    },
    timerFocused: true,
  },
  user: {
    id: undefined,
    useInspection: false,
    muteTimer: false,
    timerType: 'spacebar',
  },
  onlyShowSelf: false,
};

const mapStateToProps = (state) => ({
  room: state.room,
  user: state.user,
});

export default connect(mapStateToProps)(useStyles(Main));
