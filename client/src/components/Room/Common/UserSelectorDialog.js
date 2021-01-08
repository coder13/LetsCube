import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
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

const useStyles = makeStyles(() => ({}));

function UserSelectorDialog({
  open,
  onClose,
  onToggleUser,
  users,
  values,
  title,
}) {
  const classes = useStyles();

  return (
    <Dialog fullWidth open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <List className={classes.root}>
          {users.map((user) => (
            <ListItem key={user.id}>
              <ListItemAvatar>
                <Avatar src={user.avatar.url} alt={`Avatar for ${user.displayName}`} />
              </ListItemAvatar>
              <ListItemText id={user.id} primary={user.displayName} />
              <ListItemSecondaryAction>
                <Checkbox
                  edge="end"
                  onChange={() => onToggleUser(user.id)}
                  checked={!!values[user.id]}
                  inputProps={{ 'aria-labelledby': user.displayName }}
                />
              </ListItemSecondaryAction>
            </ListItem>
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

UserSelectorDialog.propTypes = {
  users: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number,
  })),
  // userId: boolean
  values: PropTypes.shape(),
  title: PropTypes.string,
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onToggleUser: PropTypes.func,
};

UserSelectorDialog.defaultProps = {
  users: [],
  values: {},
  title: '',
  open: false,
  onClose: () => {},
  onToggleUser: () => {},
};

export default UserSelectorDialog;
