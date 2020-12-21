import React from 'react';
import clsx from 'clsx';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
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
import { kickUser } from '../../../store/room/actions';

const useStyles = makeStyles((theme) => ({
  admin: {
    color: theme.palette.primary.main,
  },
}));

function UserListItem({ user, isSelf, handleKickUser }) {
  const classes = useStyles();

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
  isSelf: PropTypes.bool,
  handleKickUser: PropTypes.func,
};

UserListItem.defaultProps = {
  isSelf: false,
  handleKickUser: () => {},
};

function MangeUsersDialog({
  open,
  onClose,
  room: {
    users,
  },
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
          {users.map((user) => (
            <UserListItem
              key={user.id}
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

export default connect()(MangeUsersDialog);
