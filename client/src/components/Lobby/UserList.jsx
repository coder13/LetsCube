import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Toolbar from '@material-ui/core/Toolbar';
// import Divider from '@material-ui/core/Divider';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import Avatar from '@material-ui/core/Avatar';

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
          <ListItem button key={user.id}>
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
  })),
};

LobbyUserList.defaultProps = {
  users: [],
};

export default LobbyUserList;
