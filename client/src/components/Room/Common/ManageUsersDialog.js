import React from 'react';
import clsx from 'clsx';
import { connect, useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListSubheader from '@material-ui/core/ListSubheader';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import Avatar from '@material-ui/core/Avatar';
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
    users: PropTypes.array,
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
