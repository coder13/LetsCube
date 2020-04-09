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
    fetch('/api/updatePrivacy', {
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
      }));
    });
  };

  return !user.id ? (
    <div />
  ) : (
    <Grid container justify="center" className={classes.root}>
      <Grid item xs={12} md={8}>
        <Paper>
          <Grid container style={{ padding: '2em', justifyContent: 'space-between' }}>
            <Grid item xs={4}>
              <div>
                <Typography variant="body1">
                  Displaying as
                </Typography>
                <Typography variant="subtitle2" className={classes.indent}>
                  {user.displayName}
                </Typography>
              </div>

              <Divider className={classes.separate} />

              <div className={classes.separate}>
                <Typography variant="body1">
                  Real name (
                  {user.showWCAID ? 'Visible' : 'Hidden'}
                  )
                </Typography>
                <Typography variant="subtitle2" className={classes.indent}>
                  {user.name}
                </Typography>
              </div>

              <div className={classes.separate}>
                <Typography variant="body1">
                  WCA ID (
                  {user.showWCAID ? 'Visible' : 'Hidden'}
                  )
                </Typography>
                <Typography variant="subtitle2" className={classes.indent}>
                  {user.wcaId}
                </Typography>
              </div>
            </Grid>
            <Grid item lg={2} className={classes.avatarContainer}>
              <Avatar variant="square" style={{ width: '10em', height: '10em' }} src={user.avatar.url} />
            </Grid>
          </Grid>

          <Grid container className={classes.preferences}>
            <EditableTextField label="Username" value={user.username} onChange={changeUsername} />
            <Paper className={classes.input}>
              <FormControlLabel
                control={(
                  <Checkbox
                    checked={user.preferUsername}
                    onChange={handleToggle}
                    name="preferUsername"
                  />
                )}
                label="Prefer Username"
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
