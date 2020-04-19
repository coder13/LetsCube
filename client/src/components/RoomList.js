import React from 'react';
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
import AddRoomDialog from './AddRoomDialog';
import RoomListItem from './RoomListItem';
import { createRoom } from '../store/rooms/actions';

const useStyles = makeStyles((theme) => ({
  alert: {
    padding: '1em',
    '& a': {
      color: theme.palette.warning.contrastText,
      textDecoration: 'none',
    },
  },
  createRoom: {
    padding: '1em',
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  },
}));

function RoomList({ dispatch, rooms, user }) {
  const classes = useStyles();
  const [createRoomDialogOpen, setCreateRoomDialogOpen] = React.useState(false);
  const publicRooms = rooms.filter((room) => !room.private);
  const privateRooms = rooms.filter((room) => !!room.private);
  const showAlert = !!user.id && !user.canJoinRoom;

  const onCreateRoom = (options) => {
    dispatch(createRoom(options));
  };

  return (
    <Container maxWidth="md" disableGutters style={{ padding: '1em' }}>
      { showAlert && (
        <Alert
          className={classes.alert}
          severity="error"
          action={(
            <Button component={Link} color="inherit" variant="filled" to="/profile">
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
      <Paper>
        <List subheader={<ListSubheader>Public Rooms</ListSubheader>}>
          {publicRooms.map((room) => (
            <RoomListItem key={room._id} room={room} disabled={showAlert} />
          ))}
        </List>
        <Divider />
        <List subheader={<ListSubheader>Private Rooms</ListSubheader>}>
          {privateRooms.map((room) => (
            <RoomListItem key={room._id} room={room} disabled={showAlert} />
          ))}
        </List>
      </Paper>
      <AddRoomDialog
        open={createRoomDialogOpen}
        onCreateRoom={onCreateRoom}
        onClose={() => setCreateRoomDialogOpen(false)}
      />
    </Container>
  );
}

RoomList.propTypes = {
  rooms: PropTypes.arrayOf(PropTypes.shape()),
  user: PropTypes.shape({
    id: PropTypes.number,
    canJoinRoom: PropTypes.bool,
  }),
  dispatch: PropTypes.func.isRequired,
};

RoomList.defaultProps = {
  rooms: [],
  user: {
    id: undefined,
    canJoinRoom: false,
  },
};

const mapStateToProps = (state) => ({
  rooms: state.roomList.rooms,
  user: state.user,
});

export default connect(mapStateToProps)(RoomList);
