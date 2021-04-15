import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { withStyles, makeStyles, useTheme } from '@material-ui/core/styles';
import { connect, useDispatch } from 'react-redux';
import Grid from '@material-ui/core/Grid';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Divider from '@material-ui/core/Divider';
import Typography from '@material-ui/core/Typography';
import ClickAwayListener from '@material-ui/core/ClickAwayListener';
import Button from '@material-ui/core/Button';
import { Cube } from 'react-cube-svg';
import { formatISO9075 } from 'date-fns';
import calcStats from '../../../lib/stats';
import {
  submitResult,
  sendStatus,
  timerFocused,
  toggleFollowUser,
} from '../../../store/room/actions';
import { getRegisteredUsers } from '../../../store/room/selectors';
import { StatsDialogProvider } from '../Common/StatsDialogProvider';
import { EditDialogProvider } from '../Common/EditDialogProvider';
import TimesTable from '../Common/TimesTable';
import HelpPopover from '../../common/HelpPopover';
import Timer from '../../Timer/index';
import Scramble from '../../common/Scramble';
import UserStats from '../Common/UserStats';
import UserSelectorDialog from '../Common/UserSelectorDialog';

const getCountdownColor = (theme, countdown) => {
  if (theme.palette.type === 'light') {
    if (countdown < 0) {
      return theme.palette.background.paper;
    }

    if (countdown < 5) {
      return theme.palette.error.dark;
    }

    if (countdown < 10) {
      return theme.palette.error.light;
    }

    if (countdown < 15) {
      return theme.palette.warning.dark;
    }

    if (countdown < 25) {
      return theme.palette.warning.main;
    }

    if (countdown < 30) {
      return theme.palette.warning.light;
    }

    if (countdown < 35) {
      return theme.palette.grey[300];
    }

    if (countdown < 40) {
      return theme.palette.grey[200];
    }

    if (countdown < 45) {
      return theme.palette.grey[100];
    }

    if (countdown < 50) {
      return theme.palette.grey[50];
    }
  } else {
    if (countdown < 0) {
      return theme.palette.background.paper;
    }

    if (countdown < 5) {
      return theme.palette.error.dark;
    }

    if (countdown < 10) {
      return theme.palette.error.light;
    }

    if (countdown < 15) {
      return theme.palette.warning.dark;
    }

    if (countdown < 25) {
      return theme.palette.warning.main;
    }

    if (countdown < 30) {
      return theme.palette.warning.light;
    }

    if (countdown < 35) {
      return theme.palette.grey[600];
    }

    if (countdown < 40) {
      return theme.palette.grey[700];
    }

    if (countdown < 45) {
      return theme.palette.grey[800];
    }

    if (countdown < 50) {
      return theme.palette.grey[800];
    }
  }

  return theme.palette.background.paper;
};

const CountdownBox = withStyles({
  root: {
    textAlign: 'center',
    transition: 'background-color 5s',
  },
})(({ nextSolveAt, classes }) => {
  const [coutdownToNextSolve, setCoutdownToNextSolve] = useState(null);
  const theme = useTheme();

  useEffect(() => {
    let timerObj;
    if (nextSolveAt) {
      clearInterval(timerObj);
      timerObj = setInterval(() => {
        setCoutdownToNextSolve(Math.round(
          (new Date(nextSolveAt).getTime() - Date.now()) / 1000,
        ));

        if (new Date(nextSolveAt).getTime() < Date.now()) {
          clearInterval(timerObj);
        }
      }, 1000);
    } else if (!nextSolveAt && timerObj) {
      clearInterval(timerObj);
    }

    return () => {
      if (timerObj) {
        clearInterval(timerObj);
      }
    };
  }, [nextSolveAt]);

  return (
    <div
      className={classes.root}
      style={{
        backgroundColor: getCountdownColor(theme, coutdownToNextSolve),
      }}
    >
      <Typography variant="h6" style={{ fontWeight: 400 }}>
        {`Next solve in ${coutdownToNextSolve} seconds`}
      </Typography>
    </div>
  );
});

const useStyles = makeStyles((theme) => ({
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

function Main({ room, user }) {
  const classes = useStyles();
  const dispatch = useDispatch();
  const theme = useTheme();
  const [currentAttemptId, setCurrentAttemptId] = useState(undefined);
  const [followUserDialogOpen, setFollowUserDialogOpen] = useState(false);

  const {
    users, attempts, nextSolveAt, following,
  } = room;

  const registeredUsers = getRegisteredUsers(room);

  const onSubmitTime = (event) => {
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
    setCurrentAttemptId(null);
  };

  const onTimerFocused = () => {
    dispatch(timerFocused(true));
  };

  const onTimerDefocused = () => {
    dispatch(timerFocused(false));
  };

  const handleStatusChange = (status) => {
    dispatch(sendStatus(status));
  };

  const handlePriming = () => {
    const latestAttempt = room.attempts ? room.attempts[room.attempts.length - 1] : {};
    setCurrentAttemptId(latestAttempt.id);
  };

  const handleToggleUserFollow = (userId) => {
    dispatch(toggleFollowUser(userId));
  };

  const latestAttempt = attempts && attempts.length && attempts[attempts.length - 1];
  const showScrambleBox = latestAttempt && !latestAttempt.results[user.id];
  const timerDisabled = !room.timerFocused || !room.competing[user.id] || !showScrambleBox;

  const stats = calcStats(attempts, users);
  const showScramble = latestAttempt.scrambles && room.event === '333';

  return (
    <ClickAwayListener onClickAway={() => { onTimerDefocused(); }}>
      <Paper
        className={classes.root}
        variant="outlined"
        square
        onClick={() => { onTimerFocused(); }}
      >
        <StatsDialogProvider>
          <EditDialogProvider dispatch={dispatch}>
            { nextSolveAt && (
              <>
                <CountdownBox nextSolveAt={nextSolveAt} />
                <Divider />
              </>
            )}
            <div className={classes.scrambleBox}>
              { !showScrambleBox ? (
                <Typography variant="h6" style={{ fontWeight: 400 }}>
                  Waiting...
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
              {room.competing[user.id] ? (
                <>
                  <HelpPopover />
                  <Timer
                    disabled={timerDisabled}
                    onSubmitTime={(e) => onSubmitTime(e)}
                    onStatusChange={(status) => { handleStatusChange(status); }}
                    useInspection={user.useInspection}
                    onPriming={() => { handlePriming(); }}
                    type={user.timerType}
                  />
                </>
              ) : (
                <Button
                  fullWidth
                  onClick={() => setFollowUserDialogOpen(true)}
                >
                  Choose competitors to follow
                </Button>
              )}
            </div>
            <Divider />
            <TimesTable
              room={room}
              stats={stats}
              userId={user.id}
              userFilter={(u) => (
                (+u.id === +user.id && room.competing[u.id])
                || following[u.id]
              )}
            />
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
                      backgroundColor: theme.palette.background.paper,
                      padding: theme.spacing(1),
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
              {process.env.NODE_ENV === 'development' && (
                <Grid item xs={12}>
                  <Box p={1}>
                    {[
                      `Started: ${room.started}`,
                      room.nextSolveAt ? `Next Solve At: ${formatISO9075(new Date(room.nextSolveAt))}` : '',
                    ].join(' | ')}
                  </Box>
                </Grid>
              )}
            </Grid>
            <UserSelectorDialog
              open={followUserDialogOpen}
              title="Select users to follow"
              onToggleUser={handleToggleUserFollow}
              users={registeredUsers}
              values={following}
              onClose={() => setFollowUserDialogOpen(false)}
            />
          </EditDialogProvider>
        </StatsDialogProvider>
      </Paper>
    </ClickAwayListener>
  );
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
    registered: PropTypes.shape(),
    attempts: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.number,
    })),
    admin: PropTypes.shape({
      id: PropTypes.number,
    }),
    timerFocused: PropTypes.bool,
    nextSolveAt: PropTypes.string,
    started: PropTypes.bool,
    following: PropTypes.shape(),
  }),
  user: PropTypes.shape({
    id: PropTypes.number,
    useInspection: PropTypes.bool,
    muteTimer: PropTypes.bool,
    timerType: PropTypes.string,
  }),
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
    registered: {},
    attempts: [],
    admin: {
      id: undefined,
    },
    timerFocused: true,
    nextSolveAt: undefined,
    started: false,
    following: {},
  },
  user: {
    id: undefined,
    useInspection: false,
    muteTimer: false,
    timerType: 'spacebar',
  },
};

const mapStateToProps = (state) => ({
  room: state.room,
  user: state.user,
});

export default connect(mapStateToProps)(Main);
