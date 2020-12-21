import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Divider from '@material-ui/core/Divider';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Accordion from '@material-ui/core/Accordion';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';

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
  const [stateType, setType] = React.useState('normal');

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
      type: stateType,
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

  const handleTypeChange = (event) => {
    setType(event.target.value);
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
      <Divider />
      <Accordion square elevation={0}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Advanced Settings</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormControl className={classes.formControl}>
            <InputLabel htmlFor="room-type">Type</InputLabel>
            <Select
              value={stateType}
              onChange={handleTypeChange}
              inputProps={{
                name: 'Room Type',
                id: 'room-type',
              }}
            >
              <MenuItem value="normal">Normal</MenuItem>
              <MenuItem value="grand_prix">Grand Prix</MenuItem>
            </Select>
          </FormControl>
        </AccordionDetails>
      </Accordion>
      <Divider />
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
