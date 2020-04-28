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

function EditRoomDialog({ open, onSave, onCancel }) {
  const classes = useStyles();
  const [stateName, setName] = React.useState('');
  const [statePrivate, setPrivate] = React.useState(false);
  const [statePassword, setPassword] = React.useState('');

  const handleCancel = () => {
    onCancel();
  }

  const handleSave = () => {
    onSave({
      name: stateName,
      private: statePrivate,
      password: statePassword,
    });
  }

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
      <DialogTitle>Edit Room</DialogTitle>
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
          label="Password"
          type="password"
          disabled={!statePrivate}
          onChange={handlePasswordChange}
          autoFocus
          fullWidth
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} color="secondary">Cancel</Button>
        <Button onClick={handleSave} color="primary" disabled={!stateName || (statePrivate && !statePassword)}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

EditRoomDialog.propTypes = {
  open: PropTypes.bool,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

EditRoomDialog.defaultProps = {
  open: false,
};

export default EditRoomDialog;
