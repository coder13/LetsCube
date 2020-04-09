import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';
// import Container from '@material-ui/core/Container';
import Avatar from '@material-ui/core/Avatar';
import Typography from '@material-ui/core/Typography';
import EditableTextField from './EditableTextField';
import { updateProfile } from '../store/user/actions';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    padding: '1em',
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
    padding: '1em',
    width: '100%',
    border: `1px solid ${theme.palette.divider}`,
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
      }));
      cb();
    }).catch((err) => {
      err.json().then((e) => {
        cb(e.message);
      });
    });
  };

  return (
    <Grid container justify="center" className={classes.root}>
      <Grid item xs={12} md={8}>
        <Paper>
          <Grid container style={{ padding: '2em' }}>
            <Grid item xs={4}>
              <Typography
                variant="body1"
              >
                Displaying as:
              </Typography>
              <Typography
                variant="subtitle2"
              >
                {user.name}
              </Typography>
            </Grid>
            <Grid item lg={2} className={classes.avatarContainer}>
              <Avatar variant="square" style={{ width: '10em', height: '10em' }} src={user.avatar.url} />
            </Grid>
          </Grid>
          {user.id && (
            <Grid container className={classes.preferences}>
              <EditableTextField label="Username" value={user.username} onChange={changeUsername} />
            </Grid>
          )}
        </Paper>
      </Grid>
    </Grid>
  );
}

Profile.propTypes = {
  user: PropTypes.shape(),
  dispatch: PropTypes.func.isRequired,
};

Profile.defaultProps = {
  user: {
    displayName: undefined,
    name: 'foo bar',
    avatar: {
      thumb_url: undefined,
    },
  },
};

const mapStateToProps = (state) => ({
  user: state.user,
});

export default connect(mapStateToProps)(Profile);
