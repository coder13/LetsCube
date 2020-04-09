import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Toolbar from '@material-ui/core/Toolbar';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Button from '@material-ui/core/Button';
import FormGroup from '@material-ui/core/FormGroup';
import Select from '@material-ui/core/Select';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import {
  deleteRoom,
  requestNewScramble,
  changeEvent,
} from '../store/room/actions';
import { Events } from '../lib/wca';

const useStyles = makeStyles(() => ({
  adminToolbar: {
    flexDirection: 'row-reverse',
    alignItems: 'stretch',
    minHeight: '5em',
    padding: 0,
  },
  changeEventSelect: {
    paddingLeft: '.5em',
    paddingRight: '.5em',
  },
}));

function AdminToolbar({ dispatch, room }) {
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const menuOpen = Boolean(anchorEl);

  const canGenNewScramble = () => room && room.attempts.length
    && Object.keys(room.attempts[room.attempts.length - 1].results).length;

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNewScramble = () => {
    dispatch(requestNewScramble());
  };

  const handleChangeEvent = (event) => {
    dispatch(changeEvent(event.target.value));
  };

  const handleDeleteRoom = () => {
    dispatch(deleteRoom(room._id));
  };

  return (
    <Toolbar className={classes.adminToolbar}>
      <FormGroup row variant="text">
        <Button
          disabled={!canGenNewScramble()}
          onClick={handleNewScramble}
        >
          New Scramble
        </Button>
        <Select
          id="change-event-select"
          className={classes.changeEventSelect}
          value={room.event}
          onChange={handleChangeEvent}
          variant="standard"
        >
          {Events.map((event) => (
            <MenuItem key={event.id} dense value={event.id}>{event.name}</MenuItem>
          ))}
        </Select>
        <Button
          color="inherit"
          onClick={handleMenu}
          style={{ paddingLeft: '1em' }}
        >
          <MoreVertIcon />
        </Button>
      </FormGroup>
      <Menu
        id="admin-menu"
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={menuOpen}
        onClose={handleClose}
      >
        <MenuItem onClick={handleDeleteRoom}>Delete Room</MenuItem>
      </Menu>
    </Toolbar>
  );
}

AdminToolbar.propTypes = {
  dispatch: PropTypes.func.isRequired,
  room: PropTypes.shape({
    _id: PropTypes.string,
    attempts: PropTypes.array,
    event: PropTypes.string,
  }),
};

AdminToolbar.defaultProps = {
  room: {
    _id: undefined,
    attempts: [],
    event: undefined,
  },
};

export default AdminToolbar;
