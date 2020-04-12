import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import Paper from '@material-ui/core/Paper';
import Divider from '@material-ui/core/Divider';
import {
  submitResult,
  updateStatus,
} from '../../store/room/actions';
import TimesTable from './TimesTable';
import Timer from '../Timer';
import Scramble from '../Scramble';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
    padding: theme.spacing(0),
    borderRadius: 0,
    height: '100%',
  },
}));

function Main({ dispatch, room, user }) {
  const classes = useStyles();

  const onSubmitTime = (event) => {
    if (!room.attempts.length) {
      console.error('No attempt with which to submit time!');
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
    dispatch(updateStatus(user.id, status));
  };

  const { users, statuses, attempts } = room;
  const latestAttempt = (attempts && attempts.length) ? attempts[attempts.length - 1] : {};
  const timerDisabled = !!(latestAttempt.results && latestAttempt.results[user.id]);

  return (
    <Paper className={classes.root} variant="outlined" square>
      <Scramble
        event={room.event}
        disabled={timerDisabled}
        scrambles={latestAttempt.scrambles}
      />
      <Divider />
      <Timer
        disabled={timerDisabled}
        onSubmitTime={(e) => onSubmitTime(e)}
        onStatusChange={handleStatusChange}
        useInspection={user.useInspection}
      />
      <Divider />
      <TimesTable users={users} statuses={statuses} attempts={attempts} />
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
  dispatch: PropTypes.func.isRequired,
};

Main.defaultProps = {
  room: {
    _id: undefined,
    private: false,
    accessCode: undefined,
    event: '333',
    users: [],
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
};

const mapStateToProps = (state) => ({
  room: state.room,
  user: state.user,
});

export default connect(mapStateToProps)(Main);
