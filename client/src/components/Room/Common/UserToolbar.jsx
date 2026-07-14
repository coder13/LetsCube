import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@mui/styles';
import { connect } from 'react-redux';
import Toolbar from '@mui/material/Toolbar';
import FormGroup from '@mui/material/FormGroup';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import SettingsIcon from '@mui/icons-material/Settings';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Checkbox from '@mui/material/Checkbox';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { lcFetch } from '../../../lib/fetch';
import { updateCompeting } from '../../../store/room/actions';
import { updateProfile } from '../../../store/user/actions';

const useStyles = makeStyles(() => ({
  root: {
    alignItems: 'stretch',
    minHeight: '5em',
    padding: 0,
    flexGrow: 1,
  },
}));

function UserToolbar({ dispatch, room, user }) {
  const classes = useStyles();
  const [open, setOpen] = useState(false);
  const userCompeting = room.competing[user.id];

  const handleCompeting = () => {
    dispatch(updateCompeting(!userCompeting));
  };

  const handleTimerSettings = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleToggle = (event, value) => {
    const { name } = event.target;
    lcFetch('/api/updatePreference', {
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'PUT',
      body: JSON.stringify({
        [name]: value,
      }),
    }).then((res) => res.json()).then((res) => {
      dispatch(updateProfile({
        [name]: res[name],
      }));
    });
  };

  return (
    <Toolbar className={classes.root}>
      <FormGroup row variant="text">
        <Button
          color="inherit"
          onClick={handleTimerSettings}
          style={{ paddingRight: '1em' }}
        >
          <SettingsIcon />
        </Button>
        <Button onClick={handleCompeting} disabled={room.type === 'grand_prix' && !room.registered[user.id]}>
          {userCompeting ? 'Spectate' : 'Compete'}
        </Button>
      </FormGroup>
      <Dialog fullWidth open={open} onClose={handleClose}>
        <DialogTitle>Timer Settings</DialogTitle>
        <DialogContent>
          <FormGroup>
            <FormControlLabel
              control={(
                <Checkbox
                  checked={user.useInspection}
                  onChange={(e) => handleToggle(e, e.target.checked)}
                  name="useInspection"
                />
              )}
              label="Use inspection"
            />

            <FormControlLabel
              control={(
                <Checkbox
                  checked={user.muteTimer}
                  onChange={(e) => handleToggle(e, e.target.checked)}
                  name="muteTimer"
                />
              )}
              label="Mute notification"
            />

            <FormControl>
              <InputLabel id="timer-type-label">Timer Type</InputLabel>
              <Select
                labelId="timer-type-label"
                id="timer-type-select"
                value={user.timerType}
                onChange={(e) => handleToggle(e, e.target.value)}
                name="timerType"
                variant="standard"
              >
                <MenuItem value="spacebar">Keyboard</MenuItem>
                <MenuItem value="manual">Manual</MenuItem>
                <MenuItem value="stackmat">Stackmat</MenuItem>
              </Select>
            </FormControl>
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Toolbar>
  );
}

UserToolbar.propTypes = {
  dispatch: PropTypes.func.isRequired,
  room: PropTypes.shape({
    competing: PropTypes.shape(),
    registered: PropTypes.shape(),
    type: PropTypes.string,
  }),
  user: PropTypes.shape({
    id: PropTypes.number,
    useInspection: PropTypes.bool,
    muteTimer: PropTypes.bool,
    timerType: PropTypes.string,
  }),
};

UserToolbar.defaultProps = {
  room: {
    competing: {},
    registered: {},
    type: 'normal',
  },
  user: {
    id: undefined,
    useInspection: false,
    muteTimer: false,
    timerType: 'spacebar',
  },
};

const mapStateToProps = (state) => ({
  room: state.room,
  user: state.user,
});

export default connect(mapStateToProps)(UserToolbar);
