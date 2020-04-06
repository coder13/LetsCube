import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Paper from '@material-ui/core/Paper';
import Container from '@material-ui/core/Container';
import Divider from '@material-ui/core/Divider';
import List from '@material-ui/core/List';
import ListSubheader from '@material-ui/core/ListSubheader';
import AddRoomFab from './AddRoomFab';
import RoomListItem from './RoomListItem';
import { createRoom } from '../store/rooms/actions';

const RoomList = ({
  dispatch, rooms, user,
}) => {
  const publicRooms = rooms.filter((room) => !room.private);
  const privateRooms = rooms.filter((room) => !!room.private);

  const onCreateRoom = (options) => {
    dispatch(createRoom(options));
  };

  return (
    <Container maxWidth="md" disableGutters style={{ padding: '1em' }}>
      <Paper>
        <List subheader={<ListSubheader>Public Rooms</ListSubheader>}>
          {publicRooms.map((room) => (
            <RoomListItem key={room._id} room={room} />
          ))}
        </List>
        <Divider />
        <List subheader={<ListSubheader>Private Rooms</ListSubheader>}>
          {privateRooms.map((room) => (
            <RoomListItem key={room._id} room={room} />
          ))}
        </List>
      </Paper>
      {user.id && <AddRoomFab onCreateRoom={onCreateRoom} />}
    </Container>
  );
};

RoomList.propTypes = {
  rooms: PropTypes.arrayOf(PropTypes.shape()),
  user: PropTypes.shape({
    id: PropTypes.number,
  }),
  dispatch: PropTypes.func.isRequired,
};

RoomList.defaultProps = {
  rooms: [],
  user: {},
};

const mapStateToProps = (state) => ({
  rooms: state.roomList.rooms,
  user: state.user,
});

export default connect(mapStateToProps)(RoomList);
