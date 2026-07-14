import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@mui/styles';
import Paper from '@mui/material/Paper';
import Toolbar from '@mui/material/Toolbar';
// import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import { Link } from 'react-router-dom';

const useStyles = makeStyles(() => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    height: 0,
  },
}));

function LobbyUserList({ users }) {
  const classes = useStyles();

  return (
    <Paper square className={classes.root}>
      <Paper square>
        <Toolbar variant="dense">
          {`${users.length} users online`}
        </Toolbar>
      </Paper>
      <List style={{
        overflow: 'auto',
      }}
      >
        {users.map((user) => (
          <ListItem
            button={!!user.profileKey}
            component={user.profileKey ? Link : 'li'}
            key={user.id}
            {...(user.profileKey ? { to: `/users/${user.profileKey}` } : {})}
          >
            <ListItemAvatar>
              <Avatar alt={user.displayName} src={user.avatar && user.avatar.thumb_url} />
            </ListItemAvatar>
            <ListItemText primary={user.displayName} secondary={user.inARoom && 'Occupied'} />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}

LobbyUserList.propTypes = {
  users: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number,
    displayName: PropTypes.string,
    inARoom: PropTypes.boolean,
    profileKey: PropTypes.string,
  })),
};

LobbyUserList.defaultProps = {
  users: [],
};

export default LobbyUserList;
