import React, { useState } from 'react';
import { connect, useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { formatDistanceToNow, formatRFC7231 } from 'date-fns';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import { updateRegistration } from '../../../store/room/actions';
import { getRegisteredUsers } from '../../../store/room/selectors';

const useStyles = makeStyles(() => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
}));

const RegisterPanel = ({ user, room }) => {
  const classes = useStyles();
  const dispatch = useDispatch();
  const [duration, setDuration] = useState(null);
  const [unixDuration, setUnixDuration] = useState(null);
  const registered = !!room.registered[user.id];

  React.useEffect(() => {
    const startTime = room.startTime ? new Date(room.startTime) : null;
    let timerObj = null;
    if (startTime) {
      timerObj = setInterval(() => {
        setDuration(formatDistanceToNow(startTime, { addSuffix: true, includeSeconds: true }));
        setUnixDuration((startTime.getTime() - Date.now()) / 1000);
      }, 1000);
      setDuration(formatDistanceToNow(startTime, { addSuffix: true, includeSeconds: true }));
      setUnixDuration((startTime.getTime() - Date.now()) / 1000);
    }

    return () => {
      clearInterval(timerObj);
    };
  }, [room]);

  const toggleRegistration = () => {
    dispatch(updateRegistration(!registered));
  };

  return (
    <Box
      className={classes.root}
      p={1}
    >
      <Typography>
        {`Room ${unixDuration < 0 ? 'Started' : 'Starts'} ${duration} on ${formatRFC7231(new Date(room.startTime))}`}
      </Typography>
      <Box m={2}>
        <Button variant="contained" color="primary" onClick={toggleRegistration}>
          {registered ? 'unregister' : 'register'}
        </Button>
      </Box>
      <Typography>
        {`${getRegisteredUsers(room).length} registered users`}
      </Typography>
    </Box>
  );
};

RegisterPanel.propTypes = {
  room: PropTypes.shape({
    _id: PropTypes.string,
    private: PropTypes.bool,
    accessCode: PropTypes.string,
    name: PropTypes.string,
    admin: PropTypes.shape(),
    startTime: PropTypes.string,
    registered: PropTypes.shape(),
  }),
  user: PropTypes.shape({
    id: PropTypes.number,
  }),
};

RegisterPanel.defaultProps = {
  room: {
    _id: undefined,
    private: false,
    accessCode: undefined,
    name: undefined,
    type: 'normal',
    startTime: undefined,
    registered: {},
  },
  user: {
    id: undefined,
  },
};

const mapStateToProps = (state) => ({
  room: state.room,
  user: state.user,
});

export default connect(mapStateToProps)(RegisterPanel);
