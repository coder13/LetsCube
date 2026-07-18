import React, { useState } from 'react';
import { connect, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { makeStyles } from '@mui/styles';
import Paper from '@mui/material/Paper';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import ListSubheader from '@mui/material/ListSubheader';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import AddIcon from '@mui/icons-material/Add';
import DynamicFeedIcon from '@mui/icons-material/DynamicFeed';
import PeopleIcon from '@mui/icons-material/People';
import RoomConfigureDialog from '../RoomConfigureDialog';
import RoomListItem from '../RoomListItem';
import EventListItem from '../common/EventListItem';
import UserList from './UserList';
import Announcements from './Announcements';
import { createRoom } from '../../store/rooms/actions';

/**-
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
    minHeight: 0,
  },
  roomList: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    height: '100%',
    minHeight: 0,
  },
  roomListContainer: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    minHeight: 0,
    overflowY: 'auto',
  },
  eventList: {
    marginBottom: '1em',
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
    marginTop: '2em',
    marginBottom: '2em',
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  },
  userList: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    height: '100%',
  },
  flexGrow: {
    display: 'flex',
    flexGrow: 1,
    minHeight: 0,
  },
  bottomNav: {
    width: '100%',
    height: '4em',
    flexGrow: 0,
    [theme.breakpoints.up('md')]: {
      display: 'none',
    },
  },
  hiddenOnMobile: {
    [theme.breakpoints.down('sm')]: {
      display: 'none',
    },
  },
}));

const panels = [{
  name: 'Rooms',
  icon: <DynamicFeedIcon />,
}, {
  name: 'Users',
  icon: <PeopleIcon />,
}];

function Lobby({
  rooms, user, users,
}) {
  const classes = useStyles();
  const dispatch = useDispatch();
  const [createRoomDialogOpen, setCreateRoomDialogOpen] = useState(false);
  const [currentPanel, setCurrentPanel] = useState(0);
  const events = rooms.filter((room) => room.type !== 'normal');
  const publicRooms = rooms.filter((room) => !room.private && room.type === 'normal');
  const privateRooms = rooms.filter((room) => !!room.private && room.type === 'normal');
  const showAlert = !!user.id && !user.canJoinRoom;

  const waitingUsers = users.map((u) => ({
    id: u.id,
    displayName: u.displayName,
    inARoom: !!rooms.find((room) => room.users && room.users.find((i) => i.id === u.id)),
    avatar: u.avatar,
    profileKey: u.profileKey,
  }));

  const onCreateRoom = (options) => {
    dispatch(createRoom(options));
  };

  return (
    <div className={classes.root}>
      <Grid
        container
        className={classes.flexGrow}
      >
        <Grid
          item
          md={9}
          sm={12}
          className={clsx(classes.roomList, {
            [classes.hiddenOnMobile]: currentPanel !== 0,
          })}
        >
          <div
            className={classes.roomListContainer}
            data-testid="room-list-scroll-container"
          >
            <Container
              maxWidth="md"
              disableGutters
            >
              <Announcements />
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

              {user.id && (
                <Button
                  fullWidth
                  className={classes.createRoom}
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={() => setCreateRoomDialogOpen(true)}
                >
                  Create Room
                </Button>
              )}

              <div className={classes.eventList}>
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
        </Grid>
        <Grid
          item
          md={3}
          sm={12}
          className={clsx(classes.userList, {
            [classes.hiddenOnMobile]: currentPanel !== 1,
          })}
        >
          <UserList users={waitingUsers} />
        </Grid>
      </Grid>
      <BottomNavigation
        value={currentPanel}
        showLabels
        onChange={(e, v) => setCurrentPanel(v)}
        className={classes.bottomNav}
      >
        {panels.map((panel, index) => (
          <BottomNavigationAction
            key={panel.name}
            className={classes.bottomNavItem}
            label={panel.name}
            value={index}
            icon={panel.icon}
          />
        ))}
      </BottomNavigation>
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
  users: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number,
    displayName: PropTypes.string,
  })),
};

Lobby.defaultProps = {
  rooms: [],
  user: {
    id: undefined,
    canJoinRoom: false,
    showWCAID: false,
  },
  users: [],
};

const mapStateToProps = (state) => ({
  rooms: state.roomList.rooms,
  user: state.user,
  userCount: state.server.userCount,
  users: state.roomList.users,
});

export default connect(mapStateToProps)(Lobby);
