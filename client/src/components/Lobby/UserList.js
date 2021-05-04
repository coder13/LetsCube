import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Toolbar from '@material-ui/core/Toolbar';
// import Divider from '@material-ui/core/Divider';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';

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
            <ListItemText primary={user.displayName} />
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
  })),
};

LobbyUserList.defaultProps = {
  users: [],
};

export default LobbyUserList;
