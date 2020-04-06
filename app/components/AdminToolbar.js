import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Toolbar from '@material-ui/core/Toolbar';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Button from '@material-ui/core/Button';
import ButtonGroup from '@material-ui/core/ButtonGroup';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import {
  deleteRoom,
  requestNewScramble,
} from '../store/room/actions';

const useStyles = makeStyles(() => ({
  adminToolbar: {
    flexDirection: 'row-reverse',
    alignItems: 'stretch',
    minHeight: '5em',
    padding: 0,
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

  const handleDeleteRoom = () => {
    dispatch(deleteRoom(room._id));
  };

  return (
    <Toolbar className={classes.adminToolbar}>
      <ButtonGroup variant="text">
        <Button
          disabled={!canGenNewScramble()}
          onClick={handleNewScramble}
        >
          New Scramble
        </Button>
        <Button
          color="inherit"
          edge="start"
          onClick={handleMenu}
          style={{ paddingLeft: '1em' }}
        >
          <MoreVertIcon />
        </Button>
      </ButtonGroup>
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
  }),
};

AdminToolbar.defaultProps = {
  room: {
    _id: undefined,
    attempts: [],
  },
};

export default AdminToolbar;
