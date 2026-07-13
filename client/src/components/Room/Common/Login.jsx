import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import Paper from '@material-ui/core/Paper';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import { Link } from 'react-router-dom';
import {
  joinRoom,
} from '../../../store/room/actions';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
    padding: theme.spacing(0),
    borderRadius: 0,
  },
}));

function Login({ dispatch, roomId, joinError }) {
  const classes = useStyles();
  const [password, setPassword] = useState('');

  const login = (event) => {
    event.preventDefault();
    dispatch(joinRoom({
      id: roomId,
      password,
    }));
  };

  const updatePassword = (event) => {
    setPassword(event.target.value);
  };

  const helperText = joinError
    ? joinError.message : 'Enter password to login';

  return (
    <Paper className={classes.root} elevation={1}>
      <Link to="/">
        <IconButton aria-label="back">
          <ArrowBackIcon />
        </IconButton>
      </Link>
      <Paper
        elevation={2}
        style={{
          padding: '1em',
          width: '320px',
          margin: 'auto',
        }}
      >
        <form
          style={{
            display: 'flex',
            justifyContent: 'center',
          }}
          onSubmit={login}
        >
          <TextField
            label="Password"
            type="password"
            autoFocus
            helperText={helperText}
            error={!!joinError}
            value={password}
            onChange={updatePassword}
          />
          <Button
            variant="contained"
            style={{ margin: '1em' }}
            onClick={login}
          >
            Log in
          </Button>
        </form>
      </Paper>
    </Paper>
  );
}

Login.propTypes = {
  roomId: PropTypes.string,
  joinError: PropTypes.shape({
    message: PropTypes.string,
  }),
  dispatch: PropTypes.func.isRequired,
};

Login.defaultProps = {
  roomId: undefined,
  joinError: null,
};

const mapStateToProps = (state) => ({
  roomId: state.room._id,
  joinError: state.room.joinError,
});

export default connect(mapStateToProps)(Login);
