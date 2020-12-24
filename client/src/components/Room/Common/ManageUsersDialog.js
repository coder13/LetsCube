import React from 'react';
import clsx from 'clsx';
import { connect, useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import List from '@material-ui/core/List';
import ListSubheader from '@material-ui/core/ListSubheader';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import Avatar from '@material-ui/core/Avatar';
import grey from '@material-ui/core/colors/grey';
import { useConfirm } from 'material-ui-confirm';
import { kickUser, updateBanned } from '../../../store/room/actions';

const backgroundColorTransition = (theme) => theme.transitions.create('background-color', {
  duration: theme.transitions.duration.standard,
  easing: theme.transitions.easing.easeInOut,
});

const useStyles = makeStyles((theme) => ({
  admin: {
    color: theme.palette.primary.main,
  },
  listItem: {
    backgroundColor: '#ffffff',
    transition: backgroundColorTransition(theme),
    borderRadius: theme.shape.borderRadius,
    '&:hover': {
      backgroundColor: grey[100],
      transition: backgroundColorTransition(theme),
    },
  },
}));

const UserListItem = ({ room, user, isSelf }) => {
  const classes = useStyles();
  const dispatch = useDispatch();
  const confirm = useConfirm();

  const isInRoom = room.inRoom[user.id];
  const isBanned = room.banned[user.id];

  const handleKickUser = () => {
    confirm({ title: `Are you sure you want to kick ${user.displayName}?` })
      .then(() => {
        dispatch(kickUser(user.id));
      });
  };

  const handleBanUser = () => {
    confirm({ title: `Are you sure you want to ban ${user.displayName}?` })
      .then(() => {
        dispatch(updateBanned(user.id, !isBanned));
      });
  };

  return (
    <ListItem className={classes.listItem}>
      <ListItemAvatar>
        {user.avatar && <Avatar src={user.avatar.thumb_url} />}
      </ListItemAvatar>
      <ListItemText
        className={clsx({
          [classes.admin]: isSelf,
        })}
      >
        {user.displayName}
      </ListItemText>
      {!isSelf && (
        <ListItemSecondaryAction>
          <Button aria-label="kick user" onClick={handleKickUser} disabled={!isInRoom}>
            Kick
          </Button>
          <Button aria-label="ban user" onClick={handleBanUser}>
            { isBanned ? 'Unban' : 'Ban' }
          </Button>
        </ListItemSecondaryAction>
      )}
    </ListItem>
  );
};

UserListItem.propTypes = {
  room: PropTypes.shape({
    banned: PropTypes.shape(),
    inRoom: PropTypes.shape(),
  }),
  user: PropTypes.shape({
    id: PropTypes.number,
    displayName: PropTypes.string,
    avatar: PropTypes.shape({
      thumb_url: PropTypes.string,
    }),
  }).isRequired,
  isSelf: PropTypes.bool,
};

UserListItem.defaultProps = {
  room: {
    banned: {},
  },
  isSelf: false,
};

const MangeUsersDialog = ({
  open, onClose, room, self,
}) => {
  const usersInRoom = room.users.filter((user) => room.inRoom[user.id]);
  const usersNotRoomAndNotBanned = room.users.filter((user) => (
    !room.inRoom[user.id] && !room.banned[user.id]
  ));
  const bannedUsers = room.users.filter((user) => !room.inRoom[user.id] && room.banned[user.id]);

  return (
    <Dialog fullWidth open={open} onClose={onClose}>
      <DialogTitle>Manage Users</DialogTitle>
      <DialogContent>
        <List>
          <ListSubheader inset>In room</ListSubheader>
          {usersInRoom.map((user) => (
            <UserListItem
              key={user.id}
              room={room}
              user={user}
              isSelf={user.id === self.id}
            />
          ))}

          <ListSubheader inset>Not in room</ListSubheader>
          {usersNotRoomAndNotBanned.map((user) => (
            <UserListItem
              key={user.id}
              room={room}
              user={user}
              isSelf={user.id === self.id}
            />
          ))}

          <ListSubheader inset>Banned</ListSubheader>
          {bannedUsers.map((user) => (
            <UserListItem
              key={user.id}
              room={room}
              user={user}
              isSelf={user.id === self.id}
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
};

MangeUsersDialog.propTypes = {
  room: PropTypes.shape({
    users: PropTypes.array,
    inRoom: PropTypes.shape(),
    banned: PropTypes.shape(),
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
