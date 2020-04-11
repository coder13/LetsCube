import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import Paper from '@material-ui/core/Paper';
import Divider from '@material-ui/core/Divider';
import {
  submitResult,
} from '../../store/room/actions';
import AdminToolbar from './AdminToolbar';
import TimesTable from './TimesTable';
import Timer from '../Timer';
import Scramble from '../Scramble';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
    padding: theme.spacing(0),
    borderColor: theme.divider,
    borderRadius: 0,
    flexBasis: 'auto',
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

  const isAdmin = () => room.admin.id === user.id;

  const { users, attempts } = room;
  const latestAttempt = (attempts && attempts.length) ? attempts[attempts.length - 1] : {};
  const timerDisabled = !!(latestAttempt.results && latestAttempt.results[user.id]);

  return (
    <Paper className={classes.root} elevation={1}>
      { isAdmin()
        ? (
          <div style={{
            flex: 0,
            connected: false,
          }}
          >
            <AdminToolbar dispatch={dispatch} room={room} />
            <Divider />
          </div>
        ) : <br />}

      <div
        style={{
          flex: 0,
        }}
      >
        <Scramble event={room.event} scrambles={latestAttempt.scrambles} />
        <Divider />
        <Timer
          disabled={timerDisabled}
          onSubmitTime={(e) => onSubmitTime(e)}
          useInspection={user.useInspection}
        />
        <Divider />
        <TimesTable users={users} attempts={attempts} />
      </div>
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
