import React from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { format } from 'date-fns';
import { makeStyles } from '@mui/styles';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const useStyles = makeStyles((theme) => ({
  fab: {
    position: 'fixed',
    bottom: theme.spacing(2),
    right: theme.spacing(2),
  },
  formControl: {
    marginBottom: '1em',
  },
  formSwitch: {
    alignItems: 'baseline',
  },
  accordionDetails: {
    display: 'flex',
    flexDirection: 'column',
  },
}));

function RoomConfigureDialog({
  room, open, onSave, onCancel,
}) {
  const classes = useStyles();
  const [stateName, setName] = React.useState(room.name);
  const [statePrivate, setPrivate] = React.useState(room.private);
  const [statePassword, setPassword] = React.useState('');
  const [stateType, setType] = React.useState(room.type);
  const [stateRequireRI, setRequireRI] = React.useState(room.requireRevealedIdentity);
  const [stateStartTime, setStartTime] = React.useState(room.startTime ? (
    `${format(new Date(room.startTime), 'yyyy-MM-dd')}T${format(new Date(room.startTime), 'HH:mm')}`
  ) : '');
  const [stateTwitchChannel, setTwitchChannel] = React.useState(room.twitchChannel);

  const handleCancel = () => {
    setName(room.name);
    setPrivate(room.private);
    setPassword('');
    setType(room.type);
    setRequireRI(room.requireRevealedIdentity);
    setStartTime(room.startTime ? (
      `${format(new Date(room.startTime), 'yyyy-MM-dd')}T${format(new Date(room.startTime), 'HH:mm')}`
    ) : null);
    setTwitchChannel(room.twitchChannel);

    onCancel();
  };

  const handleSave = () => {
    onSave({
      name: stateName,
      private: statePrivate,
      password: statePrivate ? statePassword || undefined : null,
      type: stateType,
      requireRevealedIdentity: stateRequireRI,
      startTime: stateStartTime ? new Date(stateStartTime) : null,
      twitchChannel: stateTwitchChannel,
    });

    setPassword('');
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
      <DialogContent>
        <TextField
          className={classes.formControl}
          id="roomName"
          label="Room Name"
          onChange={handleNameChange}
          value={stateName}
          autoComplete="off"
          autoFocus
          fullWidth
        />
        <FormControlLabel
          className={classes.formControl}
          label="Private Room?"
          control={
            <Switch checked={statePrivate} onChange={handlePrivate} />
        }
        />
        <TextField
          className={classes.formControl}
          id="password"
          label={room._id ? 'New Password' : 'Password'}
          type="password"
          disabled={!statePrivate}
          onChange={handlePasswordChange}
          value={statePassword}
          helperText={room.private && statePrivate ? 'Leave blank to keep the current password.' : undefined}
          autoComplete="new-password"
          fullWidth
        />
      </DialogContent>
      <Divider />
      <Accordion square elevation={0}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Advanced Settings</Typography>
        </AccordionSummary>
        <AccordionDetails className={classes.accordionDetails}>
          <FormControl
            className={classes.formControl}
          >
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
          <FormControl className={clsx(classes.formSwitch, classes.formControl)}>
            <FormControlLabel
              control={(
                <Switch
                  checked={stateRequireRI}
                  onChange={() => setRequireRI(!stateRequireRI)}
                />
              )}
              label="Force Revealed Identity"
            />
            <FormHelperText>
              If enabled, requires all users to reveal their WCA identity.
            </FormHelperText>
          </FormControl>
          <TextField
            id="start-time"
            label="Start Time"
            type="datetime-local"
            className={clsx(classes.textField, classes.formControl)}
            value={stateStartTime}
            onChange={(e) => setStartTime(e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
            inputProps={{
              step: 60, // 1 min
            }}
          />
          { stateType === 'grand_prix' && (
            <TextField
              id="twitch-channel"
              label="Twitch Channel"
              className={classes.textField}
              value={stateTwitchChannel}
              onChange={(e) => setTwitchChannel(e.target.value)}
              InputLabelProps={{
                shrink: true,
              }}
            />
          )}
        </AccordionDetails>
      </Accordion>
      <Divider />
      <DialogActions>
        <Button onClick={handleCancel} color="secondary">Cancel</Button>
        <Button
          onClick={handleSave}
          color="primary"
          disabled={!stateName || (statePrivate && !room.private && !statePassword)}
        >
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
    type: PropTypes.string,
    requireRevealedIdentity: PropTypes.bool,
    startTime: PropTypes.string,
    twitchChannel: PropTypes.string,
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
    type: 'normal',
    requireRevealedIdentity: false,
    startTime: '',
    twitchChannel: '',
  },
  open: false,
};

export default RoomConfigureDialog;
