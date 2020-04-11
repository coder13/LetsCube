import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import Paper from '@material-ui/core/Paper';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import {
  joinRoom,
} from '../../store/room/actions';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
    padding: theme.spacing(0),
    borderRadius: 0,
  },
}));

function Login({ dispatch, roomId, loginFailed }) {
  const classes = useStyles();
  const [password, setPassword] = useState('');
  const [resetPassword, setResetPassword] = useState(false);

  // Forgive me lord
  if (loginFailed && password && !resetPassword) {
    setPassword('');

    setResetPassword(true);
  }

  const login = (event) => {
    event.preventDefault();
    setResetPassword(false);
    dispatch(joinRoom(roomId, password));
  };

  const updatePassword = (event) => {
    setPassword(event.target.value);
  };

  const helperText = (loginFailed && loginFailed.error)
    ? loginFailed.error.message : 'Enter password to login';

  return (
    <Paper className={classes.root} elevation={1}>
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
            error={!!loginFailed}
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
  loginFailed: PropTypes.shape(),
  dispatch: PropTypes.func.isRequired,
};

Login.defaultProps = {
  roomId: undefined,
  loginFailed: null,
};

const mapStateToProps = (state) => ({
  loginFailed: state.socket.loginFailed,
});

export default connect(mapStateToProps)(Login);
