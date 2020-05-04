import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import Toolbar from '@material-ui/core/Toolbar';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Button from '@material-ui/core/Button';
import FormGroup from '@material-ui/core/FormGroup';
import Select from '@material-ui/core/Select';
import ListSubheader from '@material-ui/core/ListSubheader';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import { useConfirm } from 'material-ui-confirm';
import {
  deleteRoom,
  requestNewScramble,
  changeEvent,
  editRoom,
} from '../../store/room/actions';
import { Events } from '../../lib/events';
import RoomConfigureDialog from '../RoomConfigureDialog';
import ManageUsersDialog from './ManageUsersDialog';

const useStyles = makeStyles(() => ({
  adminToolbar: {
    flexDirection: 'row-reverse',
    alignItems: 'stretch',
    minHeight: '5em',
    padding: 0,
    flexGrow: 1,
  },
  changeEventSelect: {
    paddingLeft: '.5em',
    paddingRight: '.5em',
  },
}));

function AdminToolbar({ dispatch, room, user }) {
  const classes = useStyles();
  const confirm = useConfirm();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [showEditRoomDialog, setShowEditRoomDialog] = React.useState(false);
  const [showManageUsersDialog, setShowManageUsersDialog] = React.useState(false);
  const menuOpen = Boolean(anchorEl);

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
    confirm({ description: 'Are you sure you want to change events? All times will disappear.' })
      .then(() => {
        dispatch(changeEvent(event.target.value));
      });
  };

  const handleDeleteRoom = () => {
    confirm({ description: 'Are you sure you want to delete this room? All times will disappear.' })
      .then(() => {
        dispatch(deleteRoom(room._id));
      });
  };

  const onEditRoom = (options) => {
    dispatch(editRoom(options));
  };

  return (
    <>
      <Toolbar className={classes.adminToolbar}>
        <FormGroup row variant="text">
          <Button
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
            <ListSubheader>WCA</ListSubheader>
            {Events.filter((e) => e.group === 'WCA').map((event) => (
              <MenuItem key={event.id} dense value={event.id}>{event.name}</MenuItem>
            ))}
            <ListSubheader>Other</ListSubheader>
            {Events.filter((e) => e.group !== 'WCA').map((event) => (
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
          <MenuItem onClick={() => setShowEditRoomDialog(true)}>Edit Room</MenuItem>
          <MenuItem onClick={() => setShowManageUsersDialog(true)}>Manage Users</MenuItem>
          <MenuItem onClick={handleDeleteRoom}>Delete Room</MenuItem>
        </Menu>
      </Toolbar>
      <RoomConfigureDialog
        room={room}
        open={showEditRoomDialog}
        onSave={onEditRoom}
        onCancel={() => setShowEditRoomDialog(false)}
      />
      <ManageUsersDialog
        room={room}
        open={showManageUsersDialog}
        onClose={() => setShowManageUsersDialog(false)}
        self={user}
      />
    </>
  );
}

AdminToolbar.propTypes = {
  dispatch: PropTypes.func.isRequired,
  room: PropTypes.shape({
    _id: PropTypes.string,
    attempts: PropTypes.array,
    event: PropTypes.string,
  }),
  user: PropTypes.shape({}),
};

AdminToolbar.defaultProps = {
  room: {
    _id: undefined,
    attempts: [],
    event: undefined,
  },
  user: {

  },
};

const mapStateToProps = (state) => ({
  room: state.room,
  user: state.user,
});

export default connect(mapStateToProps)(AdminToolbar);
