import React from 'react';
import clsx from 'clsx';
import { connect, useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import Avatar from '@material-ui/core/Avatar';
import DeleteIcon from '@material-ui/icons/Delete';
import { kickUser, updateUser } from '../../../store/room/actions';

const useStyles = makeStyles((theme) => ({
  admin: {
    color: theme.palette.primary.main,
  },
}));

function UserListItem({
  room, user, isSelf, handleKickUser,
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
  }

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
      {!isSelf && (
        <ListItemSecondaryAction>
          <IconButton edge="end" aria-label="delete" onClick={handleKickUser}>
            <DeleteIcon />
          </IconButton>
        </ListItemSecondaryAction>
      )}
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
    type: PropTypes.string,
  }),
  isSelf: PropTypes.bool,
  handleKickUser: PropTypes.func,
};

UserListItem.defaultProps = {
  isSelf: false,
  room: {
    competing: {},
    registered: {},
    type: 'normal',
  },
  handleKickUser: () => {},
};

function MangeUsersDialog({
  open,
  onClose,
  room,
  self,
  dispatch,
}) {
  const handleKickUser = (userId) => {
    dispatch(kickUser(userId));
  };

  return (
    <Dialog fullWidth open={open} onClose={onClose}>
      <DialogTitle>Manage Users</DialogTitle>
      <DialogContent>
        <List>
          {room.users.map((user) => (
            <UserListItem
              key={user.id}
              room={room}
              user={user}
              isSelf={user.id === self.id}
              handleKickUser={() => handleKickUser(user.id)}
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
  dispatch: PropTypes.func.isRequired,
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
});

export default connect(mapStateToProps)(MangeUsersDialog);
