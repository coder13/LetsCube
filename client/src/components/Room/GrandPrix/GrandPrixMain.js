import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { withStyles, makeStyles } from '@material-ui/core/styles';
import { connect, useDispatch } from 'react-redux';
import Grid from '@material-ui/core/Grid';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Divider from '@material-ui/core/Divider';
import Typography from '@material-ui/core/Typography';
import ClickAwayListener from '@material-ui/core/ClickAwayListener';
import grey from '@material-ui/core/colors/grey';
import { Cube } from 'react-cube-svg';
import { formatISO9075 } from 'date-fns';
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

const getCountdownColor = (theme) => ({ countdown }) => {
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

  return theme.palette.background.paper;
};

const CountdownBox = withStyles((theme) => ({
  root: (countdown) => ({
    textAlign: 'center',
    transition: 'background-color 5s',
    backgroundColor: getCountdownColor(theme)(countdown),
  }),
}))(({ countdown, classes }) => (
  <div className={classes.root}>
    <Typography variant="h6" style={{ fontWeight: 400 }}>
      {`Next solve in ${countdown} seconds`}
    </Typography>
  </div>
));

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

function Main({ room, user, onlyShowSelf }) {
  const classes = useStyles();
  const dispatch = useDispatch();
  const [currentAttemptId, setCurrentAttemptId] = useState(undefined);
  const [coutdownToNextSolve, setCoutdownToNextSolve] = useState(null);

  const { users, attempts, nextSolveAt } = room;

  useEffect(() => {
    let timerObj;
    if (nextSolveAt) {
      clearInterval(timerObj);
      timerObj = setInterval(() => {
        setCoutdownToNextSolve(Math.round(
          (new Date(nextSolveAt).getTime() - Date.now()) / 1000,
        ));
      }, 1000);
    } else if (!nextSolveAt && timerObj) {
      clearInterval(timerObj);
    }

    return () => {
      if (timerObj) {
        clearInterval(timerObj)
      }
    }
  }, [nextSolveAt]);

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
  }

  const onTimerFocused = () => {
    dispatch(timerFocused(true));
  };

  const onTimerDefocused = () => {
    dispatch(timerFocused(false));
  };

  const handleStatusChange = (status) => {
    dispatch(sendStatus(status));
  }

  const handlePriming = () => {
    const latestAttempt = room.attempts ? room.attempts[room.attempts.length - 1] : {};
    setCurrentAttemptId(latestAttempt.id);
  }

  const latestAttempt = (attempts && attempts.length) ? attempts[attempts.length - 1] : {};
  const timerDisabled = !room.timerFocused || !room.competing[user.id]
    || room.waitingFor.indexOf(user.id) === -1;
  const hidden = room.registered[user.id] && room.competing[user.id] && latestAttempt
    && latestAttempt.results[user.id];

  const stats = calcStats(attempts, users);
  const showScramble = latestAttempt.scrambles && room.event === '333';

  return (
    <ClickAwayListener onClickAway={() => { onTimerDefocused(); }}>
      <Paper
        className={classes.root}
        style={{
          backgroundColor: getCountdownColor(coutdownToNextSolve),
        }}
        variant="outlined"
        square
        onClick={() => { onTimerFocused(); }}
      >
        <StatsDialogProvider>
          <EditDialogProvider dispatch={dispatch}>
            { room.started && coutdownToNextSolve && (
              <>
                <CountdownBox countdown={coutdownToNextSolve} />
                <Divider />
              </>
            )}
            <div className={classes.scrambleBox}>
              { hidden ? (
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
              <HelpPopover />
              {room.competing[user.id] && (
                <Timer
                  disabled={timerDisabled}
                  onSubmitTime={(e) => onSubmitTime(e)}
                  onStatusChange={(status) => { handleStatusChange(status); }}
                  useInspection={user.useInspection}
                  onPriming={() => { handlePriming(); }}
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
  }),
  user: PropTypes.shape({
    id: PropTypes.number,
    useInspection: PropTypes.bool,
    muteTimer: PropTypes.bool,
    timerType: PropTypes.string,
  }),
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
    registered: {},
    attempts: [],
    admin: {
      id: undefined,
    },
    timerFocused: true,
    nextSolveAt: undefined,
    started: false,
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

export default connect(mapStateToProps)(Main);
