import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Divider from '@material-ui/core/Divider';
import Typography from '@material-ui/core/Typography';
import Popover from '@material-ui/core/Popover';
import IconButton from '@material-ui/core/IconButton';
import HelpIcon from '@material-ui/icons/Help';
import { Cube } from 'react-cube-svg';
import UIfx from 'uifx'
import notifSFX from '../../assets/notification.mp3'
import calcStats from '../../lib/stats';
import {
  submitResult,
  sendStatus,
} from '../../store/room/actions';
import { StatsDialogProvider } from './StatsDialogProvider';
import { EditDialogProvider } from './EditDialogProvider';
import TimesTable from './TimesTable';
import Timer from '../Timer/index';
import Scramble from '../Scramble';
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
      helpAnchor: null,
      currentAttemptId: undefined,
    };
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
      classes, dispatch, room, user, timerFocused,
    } = this.props;

    const { helpAnchor } = this.state;

    const {
      users, attempts, waitingFor,
    } = room;
    const latestAttempt = (attempts && attempts.length) ? attempts[attempts.length - 1] : {};
    const timerDisabled = !timerFocused || !room.competing[user.id]
      || room.waitingFor.indexOf(user.id) === -1;
    const hidden = room.competing[user.id] && waitingFor.indexOf(user.id) === -1;

    const stats = calcStats(attempts, users);
    const showScramble = latestAttempt.scrambles && room.event === '333';

    return (
      <Paper className={classes.root} variant="outlined" square>
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
              <div style={{ position: 'relative', width: 0, height: 0 }}>
                <div style={{ position: 'absolute', top: 0, left: 0 }}>
                  <IconButton
                    color="inherit"
                    onClick={(e) => this.setState({ helpAnchor: e.currentTarget })}
                  >
                    <HelpIcon />
                  </IconButton>
                  <Popover
                    open={!!helpAnchor}
                    anchorEl={helpAnchor}
                    onClose={() => this.setState({ helpAnchor: null })}
                    anchorOrigin={{
                      vertical: 'bottom',
                      horizontal: 'left',
                    }}
                    transformOrigin={{
                      vertical: 'top',
                      horizontal: 'left',
                    }}
                  >
                    <Typography style={{ paddingLeft: '.5em', paddingRight: '.5em' }}>
                      <p>Press `Spacebar` to start the timer.</p>
                      <p>Press any key to stop the timer.</p>
                      <p>Press `Enter` to submit time.</p>
                    </Typography>
                  </Popover>
                </div>
              </div>
              {room.competing[user.id] && (
                <Timer
                  disabled={timerDisabled}
                  onSubmitTime={(e) => this.onSubmitTime(e)}
                  onStatusChange={(status) => { this.handleStatusChange(status) }}
                  useInspection={user.useInspection}
                  onPriming={() => { this.handlePriming() }}
                  type={user.timerType}
                />
              )}
            </div>
            <Divider />
            <TimesTable room={room} stats={stats} userId={user.id} />
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
                    {waitingFor.map((userId) => users.find((u) => u.id === userId)).filter((u) => !!u).map((u) => u.displayName).join(', ')}
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
  }),
  user: PropTypes.shape({
    id: PropTypes.number,
    useInspection: PropTypes.bool,
    muteTimer: PropTypes.bool,
    timerType: PropTypes.string,
  }),
  timerFocused: PropTypes.bool,
  dispatch: PropTypes.func.isRequired,
  classes: PropTypes.shape().isRequired,
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
  },
  user: {
    id: undefined,
    useInspection: false,
    muteTimer: false,
    timerType: 'spacebar',
  },
  timerFocused: true,
};

const mapStateToProps = (state) => ({
  room: state.room,
  user: state.user,
});

export default connect(mapStateToProps)(useStyles(Main));
