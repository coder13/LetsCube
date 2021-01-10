import React from 'react';
import ReactMarkdown from 'react-markdown';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Container from '@material-ui/core/Container';
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
import EventListItem from './EventListItem';
import { lcFetch } from '../lib/fetch';
import { createRoom } from '../store/rooms/actions';

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
    overflowY: 'auto',
    flexGrow: 1,
    height: 0,
  },
  sideArea: {
    display: 'flex',
    flexDirection: 'row',
    height: '3em',
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
  userCounter: {
    display: 'flex',
    width: '12em',
    padding: '1em',
    alignItems: 'center',
  },
  announcements: {
    padding: '1em',
    marginTop: '1em',
    marginBottom: '1em',
  },
}));

function RoomList({
  dispatch, rooms, user, userCount,
}) {
  const classes = useStyles();
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
      <div className={classes.roomList}>
        <Container maxWidth="md" disableGutters>
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
      <div className={classes.sideArea}>
        <Paper
          className={classes.userCounter}
          variant="outlined"
          square
        >
          {`Users Online: ${userCount}`}
        </Paper>
      </div>
      <RoomConfigureDialog
        open={createRoomDialogOpen}
        onSave={onCreateRoom}
        onCancel={() => setCreateRoomDialogOpen(false)}
      />
    </div>
  );
}

RoomList.propTypes = {
  rooms: PropTypes.arrayOf(PropTypes.shape({
    requireRevealedIdentity: PropTypes.bool,
  })),
  user: PropTypes.shape({
    id: PropTypes.number,
    canJoinRoom: PropTypes.bool,
    showWCAID: PropTypes.bool,
  }),
  dispatch: PropTypes.func.isRequired,
  userCount: PropTypes.number,
};

RoomList.defaultProps = {
  rooms: [],
  user: {
    id: undefined,
    canJoinRoom: false,
    showWCAID: false,
  },
  userCount: 0,
};

const mapStateToProps = (state) => ({
  rooms: state.roomList.rooms,
  user: state.user,
  userCount: state.server.userCount,
});

export default connect(mapStateToProps)(RoomList);
