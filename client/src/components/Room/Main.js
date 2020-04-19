import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import Paper from '@material-ui/core/Paper';
import Divider from '@material-ui/core/Divider';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import calcStats from '../../lib/stats';
import {
  submitResult,
  sendStatus,
} from '../../store/room/actions';
import TimesTable from './TimesTable';
import Timer from '../Timer/index';
import Scramble from '../Scramble';
import UserStats from './UserStats';

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
}));

function Main({
  dispatch, room, user, timerFocused,
}) {
  const classes = useStyles();
  const [timerType, setTimerType] = React.useState('manual');

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
      id: latestAttempt.id,
      result: {
        time: event.time,
        penalties: event.penalties,
      },
    }));
  };

  const handleStatusChange = (status) => {
    dispatch(sendStatus(status));
  };

  const toggleTimerType = () => {
    setTimerType(timerType === 'spacebar' ? 'manual' : 'spacebar');
  };

  const {
    users, attempts, waitingFor,
  } = room;
  const latestAttempt = (attempts && attempts.length) ? attempts[attempts.length - 1] : {};
  const timerDisabled = !timerFocused || !room.competing[user.id]
    || room.waitingFor.indexOf(user.id) === -1;

  const stats = calcStats(attempts, users);

  return (
    <Paper className={classes.root} variant="outlined" square>
      <Scramble
        event={room.event}
        disabled={timerDisabled}
        scrambles={latestAttempt.scrambles}
      />
      <Divider />
      <div style={{
        display: 'flex',
        flexDirection: 'row',
      }}
      >
        <Button
          style={{
            fontSize: '.75em',
            padding: 0,
          }}
          onClick={toggleTimerType}
        >
          Switch to
          {' '}
          {timerType === 'spacebar' ? 'manual' : 'spacebar'}
        </Button>
        <Timer
          disabled={timerDisabled}
          onSubmitTime={(e) => onSubmitTime(e)}
          onStatusChange={handleStatusChange}
          useInspection={user.useInspection}
          type={timerType}
        />
      </div>
      <Divider />
      <TimesTable room={room} stats={stats} />
      <UserStats stats={stats[user.id]} />
      <Paper
        className={classes.waitingForBox}
        square
      >
        <Typography variant="body2">
          Waiting For:
          {' '}
          {waitingFor.map((userId) => users.find((u) => u.id === userId)).filter((u) => !!u).map((u) => u.displayName).join(', ')}
        </Typography>
      </Paper>
    </Paper>
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
  }),
  timerFocused: PropTypes.bool,
  dispatch: PropTypes.func.isRequired,
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
  },
  timerFocused: true,
};

const mapStateToProps = (state) => ({
  room: state.room,
  user: state.user,
});

export default connect(mapStateToProps)(Main);
