import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';

const useStyles = makeStyles((theme) => ({
  fab: {
    position: 'fixed',
    bottom: theme.spacing(2),
    right: theme.spacing(2),
  },
}));

function RoomConfigureDialog({
  room, open, onSave, onCancel,
}) {
  const classes = useStyles();
  const [stateName, setName] = React.useState(room.name);
  const [statePrivate, setPrivate] = React.useState(room.private);
  const [statePassword, setPassword] = React.useState(room.private ? room.accessCode : null);

  const handleCancel = () => {
    setName(room.name);
    setPrivate(room.private);
    setPassword(null);

    onCancel();
  };

  const handleSave = () => {
    onSave({
      name: stateName,
      private: statePrivate,
      password: statePrivate ? statePassword : null,
    });

    setPassword(null);
    onCancel(); // Close the dialog box
  };

  const handlePrivate = () => {
    setPrivate(!statePrivate);
  };

  const handleNameChange = (event) => {
    if (event.target.value.length < 100) {
      setName(event.target.value);
    }
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
  };

  return (
    <Dialog open={open} onClose={handleCancel}>
      <DialogTitle>
        {room._id ? 'Edit Room' : 'Create Room'}
      </DialogTitle>
      <DialogContent className={classes.paper}>
        <TextField
          id="roomName"
          label="Room Name"
          onChange={handleNameChange}
          value={stateName}
          autoComplete="off"
          autoFocus
          fullWidth
        />
        <FormControlLabel
          label="Private Room?"
          control={
            <Switch checked={statePrivate} onChange={handlePrivate} />
        }
        />
        <TextField
          id="password"
          label={room._id ? 'New Password' : 'Password'}
          type="password"
          disabled={!statePrivate}
          onChange={handlePasswordChange}
          // autoFocus
          fullWidth
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} color="secondary">Cancel</Button>
        <Button onClick={handleSave} color="primary" disabled={!stateName || (statePrivate && !statePassword)}>
          {room._id ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

RoomConfigureDialog.propTypes = {
  room: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    private: PropTypes.bool,
    accessCode: PropTypes.string,
  }),
  open: PropTypes.bool,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

RoomConfigureDialog.defaultProps = {
  room: {
    _id: undefined,
    name: '',
    private: false,
    accessCode: null,
  },
  open: false,
};

export default RoomConfigureDialog;
