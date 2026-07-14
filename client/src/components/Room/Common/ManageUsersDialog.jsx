import React from 'react';
import clsx from 'clsx';
import { connect, useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { makeStyles } from '@mui/styles';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import { kickUser, updateUser, updateBanned } from '../../../store/room/actions';
import {
  getUsersInRoom,
  getUnbannedUsersNotInRoom,
  getBannedUsers,
} from '../../../store/room/selectors';

const useStyles = makeStyles((theme) => ({
  admin: {
    color: theme.palette.primary.main,
  },
}));

function UserListItem({
  room, user, isSelf,
}) {
  const classes = useStyles();
  const dispatch = useDispatch();
  const status = {
    competing: room.competing[user.id],
    registered: room.registered[user.id],
  };

  const handleToggleUser = (option) => () => {
    dispatch(updateUser(user.id, {
      [option]: !status[option],
    }));
  };

  const handleKickUser = () => {
    dispatch(kickUser(user.id));
  };

  const handleBanUser = () => {
    dispatch(updateBanned(user.id, !room.banned[user.id]));
  };

  return (
    <ListItem>
      <ListItemAvatar>
        {user.avatar && <Avatar src={user.avatar.url} />}
      </ListItemAvatar>
      <ListItemText
        className={clsx({
          [classes.admin]: isSelf,
        })}
      >
        {user.displayName}
      </ListItemText>
      <FormControlLabel
        control={(
          <Checkbox
            checked={status.competing}
            onChange={handleToggleUser('competing')}
            name="checkbox-competing"
            color="primary"
          />
        )}
        label="Competing"
      />
      { room.type === 'grand_prix' && (
        <FormControlLabel
          control={(
            <Checkbox
              checked={status.registered}
              onChange={handleToggleUser('registered')}
              name="checkbox-registered"
              color="primary"
            />
          )}
          label="Registered"
        />
      )}
      <Button
        edge="end"
        aria-label="kick"
        disabled={isSelf || !room.inRoom[user.id]}
        onClick={handleKickUser}
      >
        KICK
      </Button>
      <Button
        edge="end"
        aria-label="ban"
        disabled={isSelf}
        onClick={handleBanUser}
      >
        { room.banned[user.id] ? 'UNBAN' : 'BAN' }
      </Button>
    </ListItem>
  );
}

UserListItem.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.number,
    displayName: PropTypes.string,
    avatar: PropTypes.shape({
      url: PropTypes.string,
    }),
  }).isRequired,
  room: PropTypes.shape({
    competing: PropTypes.shape(),
    registered: PropTypes.shape(),
    banned: PropTypes.shape(),
    inRoom: PropTypes.shape(),
    type: PropTypes.string,
  }),
  isSelf: PropTypes.bool,
};

UserListItem.defaultProps = {
  isSelf: false,
  room: {
    competing: {},
    registered: {},
    inRoom: {},
    type: 'normal',
  },
};

function MangeUsersDialog({
  open,
  onClose,
  room,
  self,
}) {
  const userInRoom = getUsersInRoom(room);
  const unbannedUsersNotInRoom = getUnbannedUsersNotInRoom(room);
  const bannedUsers = getBannedUsers(room);

  return (
    <Dialog fullWidth open={open} onClose={onClose}>
      <DialogTitle>Manage Users</DialogTitle>
      <DialogContent>
        <List>
          <ListSubheader>In Room</ListSubheader>
          {userInRoom.map((user) => (
            <UserListItem
              key={user.id}
              room={room}
              user={user}
              isSelf={+user.id === +self.id}
            />
          ))}
          <ListSubheader>Not in Room</ListSubheader>
          {unbannedUsersNotInRoom.map((user) => (
            <UserListItem
              key={user.id}
              room={room}
              user={user}
              isSelf={+user.id === +self.id}
            />
          ))}
          <ListSubheader>Banned</ListSubheader>
          {bannedUsers.map((user) => (
            <UserListItem
              key={user.id}
              room={room}
              user={user}
              isSelf={+user.id === +self.id}
            />
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

MangeUsersDialog.propTypes = {
  room: PropTypes.shape({
    users: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.number,
    })),
  }),
  self: PropTypes.shape({
    id: PropTypes.number,
  }),
  open: PropTypes.bool,
  onClose: PropTypes.func,
};

MangeUsersDialog.defaultProps = {
  room: {
    users: [],
  },
  self: {
    id: undefined,
  },
  open: false,
  onClose: () => {},
};

const mapStateToProps = (state) => ({
  room: state.room,
  self: state.user,
});

export default connect(mapStateToProps)(MangeUsersDialog);
