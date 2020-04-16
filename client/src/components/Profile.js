import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';
import Avatar from '@material-ui/core/Avatar';
import Typography from '@material-ui/core/Typography';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Divider from '@material-ui/core/Divider';
import Alert from '@material-ui/lab/Alert';
import EditableTextField from './EditableTextField';
import { updateProfile } from '../store/user/actions';

const validate = (username) => {
  if (!username) {
    return '';
  }

  if (username.indexOf(' ') > -1) {
    return 'Username cannot contains spaces';
  }

  if (username.length >= 16) {
    return 'Username cannot be longer than 16 characters';
  }

  return '';
};

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    padding: '1em',
  },
  avatar: {
    width: '10em',
    height: '10em',
    boxShadow: theme.shadows[1],
  },
  avatarContainer: {
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'row-reverse',
  },
  preferences: {
    padding: '1em',
  },
  input: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    border: `1px solid ${theme.palette.divider}`,
    transition: '2s',
    padding: '1em',
    borderRadius: theme.borderRadius,
    marginBottom: '1em',
  },
  separate: {
    marginTop: '.5em',
    marginBottom: '.5em',
  },
  indent: {
    marginLeft: '1em',
  },
}));

function Profile({ user, dispatch }) {
  const classes = useStyles();

  const changeUsername = (username, cb) => {
    fetch('/api/updateUsername', {
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'PUT',
      body: JSON.stringify({
        username,
      }),
    }).then((res) => {
      if (!res.ok) {
        throw res;
      }

      return res.json();
    }).then((res) => {
      dispatch(updateProfile({
        username: res.username,
        displayName: res.displayName,
        canJoinRoom: res.canJoinRoom,
      }));
      cb();
    }).catch((err) => {
      err.json().then((e) => {
        cb(e.message);
      });
    });
  };

  const handleToggle = (event) => {
    const { name, checked } = event.target;
    fetch('/api/updatePreference', {
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'PUT',
      body: JSON.stringify({
        [name]: checked,
      }),
    }).then((res) => res.json()).then((res) => {
      dispatch(updateProfile({
        [name]: res[name],
        displayName: res.displayName,
        canJoinRoom: res.canJoinRoom,
      }));
    });
  };

  return !user.id ? (
    <div />
  ) : (
    <Grid container justify="center" className={classes.root}>
      <Grid item xs={12} md={8}>
        {!user.canJoinRoom && (
          <Alert
            severity="error"
            style={{ fontSize: '1.25em' }}
          >
            Must set a username or check `Prefer Real Name` before joining a room.
          </Alert>
        )}
        <Paper>
          <Grid container style={{ padding: '2em', justifyContent: 'space-between' }}>
            <Grid item xs={4}>
              <div>
                <Typography component="span" variant="body1">
                  Displaying as:
                </Typography>
                {user.displayName ? (
                  <Typography component="span" variant="subtitle2" className={classes.indent}>
                    {user.displayName}
                  </Typography>
                ) : (
                  <Typography component="span" variant="subtitle2" className={classes.indent}>
                    NO NAME SET
                  </Typography>

                )}
              </div>

              <Divider className={classes.separate} />

              <div className={classes.separate}>
                <Typography component="span" variant="body1">
                  Real name (
                  {user.showWCAID ? 'Visible' : 'Hidden'}
                  ):
                </Typography>
                <Typography component="span" variant="subtitle2" className={classes.indent}>
                  {user.name}
                </Typography>
              </div>

              <div className={classes.separate}>
                <Typography component="span" variant="body1">
                  WCA ID (
                  {user.showWCAID ? 'Visible' : 'Hidden'}
                  ):
                </Typography>
                <Typography component="span" variant="subtitle2" className={classes.indent}>
                  {user.wcaId}
                </Typography>
              </div>
            </Grid>
            <Grid item lg={2} className={classes.avatarContainer}>
              <Avatar variant="square" className={classes.avatar} src={user.avatar.url} />
            </Grid>
          </Grid>

          <Grid container className={classes.preferences}>
            <EditableTextField
              label="Username"
              value={user.username}
              onChange={changeUsername}
              validate={validate}
            />
            <Paper className={classes.input}>
              <FormControlLabel
                control={(
                  <Checkbox
                    checked={user.preferRealName}
                    onChange={handleToggle}
                    name="preferRealName"
                  />
                )}
                label="Prefer Real Name"
              />
              <FormControlLabel
                control={(
                  <Checkbox
                    checked={user.showWCAID}
                    onChange={handleToggle}
                    name="showWCAID"
                  />
                )}
                label="Show WCA Identity"
              />
              <FormControlLabel
                control={(
                  <Checkbox
                    checked={user.useInspection}
                    onChange={handleToggle}
                    name="useInspection"
                  />
                )}
                label="Use inspection"
              />
              <p>All preferences get saved automatically.</p>
            </Paper>
          </Grid>
        </Paper>
      </Grid>
    </Grid>
  );
}

Profile.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.number,
    displayName: PropTypes.string,
    name: PropTypes.string,
    username: PropTypes.string,
    preferRealName: PropTypes.bool,
    showWCAID: PropTypes.bool,
    canJoinRoom: PropTypes.bool,
    wcaId: PropTypes.string,
    useInspection: PropTypes.bool,
    avatar: PropTypes.shape({
      url: PropTypes.string,
    }),
  }),
  dispatch: PropTypes.func.isRequired,
};

Profile.defaultProps = {
  user: {
    id: undefined,
    displayName: undefined,
    name: '',
    username: '',
    preferRealName: false,
    showWCAID: false,
    canJoinRoom: false,
    wcaId: '',
    useInspection: false,
    avatar: {
      url: undefined,
    },
  },
};

const mapStateToProps = (state) => ({
  user: state.user,
});

export default connect(mapStateToProps)(Profile);
