import React from 'react';
import ReactMarkdown from 'react-markdown';
import { connect, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Container from '@material-ui/core/Container';
import Grid from '@material-ui/core/Grid';
import Divider from '@material-ui/core/Divider';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import Button from '@material-ui/core/Button';
import Alert from '@material-ui/lab/Alert';
import ListSubheader from '@material-ui/core/ListSubheader';
import AddIcon from '@material-ui/icons/Add';
// import AddRoomDialog from './AddRoomDialog';
import RoomConfigureDialog from './RoomConfigureDialog';
import RoomListItem from './RoomListItem';
import EventListItem from './common/EventListItem';
import LobbyUserList from './LobbyUserList';
import { lcFetch } from '../lib/fetch';
import { createRoom } from '../store/rooms/actions';

/**
 * Lobby:
 * Has 2 parts: room list and user list
 * should render with tabs on mobile like the Room page
 * should render with gutters around the room list on larger displays
 * on smaller displays, room list and user list touch
 * user list gets fixed to the right side
 * user list open can toggle?
 * top half of user list are friends (todo)
 * bottom half are all users
 * these users will show up if they are in a room or not.
 * We can report what public rooms they're or if they're in a private room.
 */

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    height: '100%',
  },
  roomList: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
  },
  roomListContainer: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    height: 0,
    overflowY: 'auto',
  },
  alert: {
    padding: '1em',
    '& a': {
      color: theme.palette.text.primary,
      textDecoration: 'none',
    },
  },
  createRoom: {
    padding: '1em',
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  },
  announcements: {
    padding: '1em',
    marginTop: '1em',
    marginBottom: '1em',
  },
  userList: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
  },
  flexGrow: {
    display: 'flex',
    flexGrow: 1,
  },
}));

const USERS = [{
  id: 8184,
  displayName: 'Caleb Hoover',
}, {
  id: 8185,
  displayName: 'Caleb Hoover',
}, {
  id: 8186,
  displayName: 'Caleb Hoover',
}, {
  id: 8187,
  displayName: 'Caleb Hoover',
}, {
  id: 8188,
  displayName: 'Caleb Hoover',
}, {
  id: 8189,
  displayName: 'Caleb Hoover',
}, {
  id: 8190,
  displayName: 'Caleb Hoover',
}, {
  id: 8191,
  displayName: 'Caleb Hoover',
}, {
  id: 8192,
  displayName: 'Caleb Hoover',
}, {
  id: 8193,
  displayName: 'Caleb Hoover',
}, {
  id: 8194,
  displayName: 'Caleb Hoover',
}, {
  id: 8195,
  displayName: 'Caleb Hoover',
}, {
  id: 8196,
  displayName: 'Caleb Hoover',
}, {
  id: 8197,
  displayName: 'Caleb Hoover',
}, {
  id: 8198,
  displayName: 'Caleb Hoover',
}, {
  id: 8199,
  displayName: 'Caleb Hoover',
}, {
  id: 8200,
  displayName: 'Caleb Hoover',
}, {
  id: 8201,
  displayName: 'Caleb Hoover',
}, {
  id: 8202,
  displayName: 'Caleb Hoover',
}, {
  id: 8203,
  displayName: 'Caleb Hoover',
}, {
  id: 8204,
  displayName: 'Caleb Hoover',
}, {
  id: 8205,
  displayName: 'Caleb Hoover',
}, {
  id: 8206,
  displayName: 'Caleb Hoover',
}, {
  id: 8207,
  displayName: 'Caleb Hoover',
}, {
  id: 8208,
  displayName: 'Caleb Hoover',
}, {
  id: 8209,
  displayName: 'Caleb Hoover',
}, {
  id: 8210,
  displayName: 'Caleb Hoover',
}];

function Lobby({
  rooms, user,
}) {
  const classes = useStyles();
  const dispatch = useDispatch();
  const [createRoomDialogOpen, setCreateRoomDialogOpen] = React.useState(false);
  const [announcements, setAnnouncements] = React.useState('');
  const events = rooms.filter((room) => room.type !== 'normal');
  const publicRooms = rooms.filter((room) => !room.private && room.type === 'normal');
  const privateRooms = rooms.filter((room) => !!room.private && room.type === 'normal');
  const showAlert = !!user.id && !user.canJoinRoom;

  const onCreateRoom = (options) => {
    dispatch(createRoom(options));
  };

  React.useEffect(() => {
    lcFetch('/api/announcements')
      .then((data) => {
        if (!data.ok) {
          throw new Error();
        }
        return data.text();
      })
      .then((data) => {
        setAnnouncements(data);
      })
      .catch((err) => {
        throw err;
      });
  }, []);

  return (
    <div className={classes.root}>
      <Grid
        container
        className={classes.flexGrow}
      >
        <Grid
          item
          xs={9}
          className={classes.roomList}
        >
          <div
            className={classes.roomListContainer}
          >
            <Container
              maxWidth="md"
              disableGutters
            >
              { announcements && (
                <Paper className={classes.announcements}>
                  <ReactMarkdown
                    linkTarget="_blank"
                    source={announcements}
                  />
                </Paper>
              )}
              { showAlert && (
                <Alert
                  className={classes.alert}
                  severity="error"
                  action={(
                    <Button component={Link} color="inherit" to="/profile">
                      GO TO PROFILE
                    </Button>
                  )}
                >
                  <Link to="/profile">
                    Must update profile settings before joining a room.
                  </Link>
                </Alert>
              )}

              <br />
              {user.id && (
                <>
                  <ListItem
                    button
                    className={classes.createRoom}
                    variant="contained"
                    color="primary"
                    component={Button}
                    onClick={() => setCreateRoomDialogOpen(true)}
                  >
                    <ListItemIcon>
                      <AddIcon />
                    </ListItemIcon>
                    Create Room
                  </ListItem>
                  <br />
                </>
              )}

              <div
                style={{
                  marginBottom: '1em',
                }}
              >
                { events.map((room) => <EventListItem key={room._id} room={room} />)}
              </div>

              <Paper>
                <List subheader={<ListSubheader>Public Rooms</ListSubheader>}>
                  {publicRooms.map((room) => (
                    <RoomListItem
                      key={room._id}
                      room={room}
                    />
                  ))}
                </List>
                <List subheader={<ListSubheader>Public Rooms</ListSubheader>}>
                  {publicRooms.map((room) => (
                    <RoomListItem
                      key={room._id}
                      room={room}
                    />
                  ))}
                </List>
                <List subheader={<ListSubheader>Public Rooms</ListSubheader>}>
                  {publicRooms.map((room) => (
                    <RoomListItem
                      key={room._id}
                      room={room}
                    />
                  ))}
                </List>
                <Divider />
                <List subheader={<ListSubheader>Private Rooms</ListSubheader>}>
                  {privateRooms.map((room) => (
                    <RoomListItem
                      key={room._id}
                      room={room}
                    />
                  ))}
                </List>
              </Paper>
            </Container>
          </div>
        </Grid>
        <Grid item xs={3} className={classes.userList}>
          <LobbyUserList users={USERS} />
        </Grid>
      </Grid>
      <RoomConfigureDialog
        open={createRoomDialogOpen}
        onSave={onCreateRoom}
        onCancel={() => setCreateRoomDialogOpen(false)}
      />
    </div>
  );
}

Lobby.propTypes = {
  rooms: PropTypes.arrayOf(PropTypes.shape({
    requireRevealedIdentity: PropTypes.bool,
  })),
  user: PropTypes.shape({
    id: PropTypes.number,
    canJoinRoom: PropTypes.bool,
    showWCAID: PropTypes.bool,
  }),
};

Lobby.defaultProps = {
  rooms: [],
  user: {
    id: undefined,
    canJoinRoom: false,
    showWCAID: false,
  },
};

const mapStateToProps = (state) => ({
  rooms: state.roomList.rooms,
  user: state.user,
  userCount: state.server.userCount,
});

export default connect(mapStateToProps)(Lobby);
