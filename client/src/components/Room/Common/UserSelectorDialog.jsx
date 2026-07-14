import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@mui/styles';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import Avatar from '@mui/material/Avatar';

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
