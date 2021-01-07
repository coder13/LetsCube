import React from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { format } from 'date-fns';
import { makeStyles } from '@material-ui/core/styles';
import Divider from '@material-ui/core/Divider';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';
import FormHelperText from '@material-ui/core/FormHelperText';
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
  const [statePassword, setPassword] = React.useState(room.private ? room.accessCode : null);
  const [stateType, setType] = React.useState(room.type);
  const [stateRequireRI, setRequireRI] = React.useState(room.requireRevealedIdentity);
  const [stateStartTime, setStartTime] = React.useState(room.startTime ? (
    `${format(new Date(room.startTime), 'yyyy-MM-dd')}T${format(new Date(room.startTime), 'HH:mm')}`
  ) : '');
  const [stateTwitchChannel, setTwitchChannel] = React.useState(room.twitchChannel);

  const handleCancel = () => {
    setName(room.name);
    setPrivate(room.private);
    setPassword(null);
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
      password: statePrivate ? statePassword : null,
      type: stateType,
      requireRevealedIdentity: stateRequireRI,
      startTime: stateStartTime ? new Date(stateStartTime) : null,
      twitchChannel: stateTwitchChannel,
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
          // autoFocus
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
    accessCode: null,
    type: 'normal',
    requireRevealedIdentity: false,
    startTime: '',
    twitchChannel: '',
  },
  open: false,
};

export default RoomConfigureDialog;
