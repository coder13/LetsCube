import React from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import Paper from '@material-ui/core/Paper';
import Container from '@material-ui/core/Container';
import Divider from '@material-ui/core/Divider';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListSubheader from '@material-ui/core/ListSubheader';
import Typography from '@material-ui/core/Typography';
import PublicIcon from '@material-ui/icons/Public';
import PrivateIcon from '@material-ui/icons/Lock';
import AddRoomFab from './AddRoomFab';
import { createRoom } from '../store/rooms/actions';
import { getNameFromId } from '../lib/wca';

const RoomList = ({ rooms, user, fetching, createRoom }) => {
  const publicRooms = rooms.filter(room => !room.private);
  const privateRooms = rooms.filter(room => !!room.private);

  return (
    <Container maxWidth="md" disableGutters style={{padding: '1em'}}>
      <Paper>
        <List subheader={<ListSubheader>Public Rooms</ListSubheader>}>
          {publicRooms.map((room, index) => (
            <Room key={index} room={room} />
            ))}
        </List>
        <Divider/>
        <List subheader={<ListSubheader>Private Rooms</ListSubheader>}>
          {privateRooms.map((room, index) => (
            <Room key={index} room={room} />
            ))}
        </List>
      </Paper>
      {user.id && <AddRoomFab createRoom={createRoom}/>}
    </Container>
  );
}

function ListItemLink (props) {
  return (
    <ListItem button component={Link} {...props} />
  );
}

function Room ({ room }) {
  const userText = room.usersLength === 0 ? 'nobody' : `${room.usersLength} user${room.usersLength > 1 ? 's' : ''}`;

  return (
    <ListItemLink
      to={`/rooms/${room._id}`}
    >
      <ListItemIcon>
        { room.private ?
          <PrivateIcon /> :
          <PublicIcon />
        }
      </ListItemIcon>
      <ListItemText primary={
        <Typography variant="h6">
          {room.name}
        </Typography>
      } secondary={
        <Typography>
          {getNameFromId(room.event)} | {userText}
        </Typography>
      }/>
    </ListItemLink>
  );  
}

const mapStateToProps = (state) => ({
  fetching: state.roomList.fetching,
  rooms: state.roomList.rooms,
  user: state.user
});

const mapDispatchToProps = (dispatch) => ({
  createRoom: room => dispatch(createRoom(room)),
});

export default connect(mapStateToProps, mapDispatchToProps)(RoomList);