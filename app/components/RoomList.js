import React, { useState } from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import Fab from '@material-ui/core/Fab';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import Paper from '@material-ui/core/Paper';
import Container from '@material-ui/core/Container';
import Divider from '@material-ui/core/Divider';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListSubheader from '@material-ui/core/ListSubheader';
import PublicIcon from '@material-ui/icons/Public';
import PrivateIcon from '@material-ui/icons/Lock';
import AddIcon from '@material-ui/icons/Add';
import { createRoom } from '../store/rooms/actions';

const useStyles = makeStyles(theme => ({
  fab: {
    position: 'absolute',
    bottom: theme.spacing(2),
    right: theme.spacing(2)
  },
}));

const RoomList = ({ rooms, fetching, createRoom }) => {
  const publicRooms = rooms.filter(room => !room.password);
  const privateRooms = rooms.filter(room => !!room.password);

  if (fetching) {
    return (
      <Container>
        <p>Fetching...</p>
      </Container>
    );
  }

  return (
    <Container>
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
      <AddRoomFab createRoom={createRoom}/>
    </Container>
  );
}

function ListItemLink (props) {
  return (
    <ListItem button component={Link} {...props} />
  );
}

function Room ({ room }) {
  console.log(room.id);
  return (
    <ListItemLink
      to={`/rooms/${room.id}`}
    >
      <ListItemIcon>
        { room.private ?
          <PrivateIcon /> :
          <PublicIcon />
        }
      </ListItemIcon>
      <ListItemText primary={room.name}/>
    </ListItemLink>
  );  
}

function AddRoomFab ({ createRoom }) {
  const classes = useStyles();
  const [open, setOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [isPrivate, setPrivate] = useState(false);
  const [password, setPassword] = useState('');

  const handleOpen = () => {
    setOpen(true);
  }

  const handlePrivate = (event) => {
    setPrivate(!isPrivate)
  }

  const handleRoomNameChange = (event) => {
    setRoomName(event.target.value)
  }

  const handlePasswordChange = (event) => {
    setPassword(event.target.value)
  }

  const handleClose = () => {
    setOpen(false);
    setRoomName('');
    setPrivate(false);
    setPassword('');
  }

  const handleSubmit = () => {
    createRoom({
      name: roomName,
      password
    });
  }

  return (
    <div>
      <Fab className={classes.fab} onClick={handleOpen}>
        <AddIcon />
      </Fab>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Create Room</DialogTitle>
        <DialogContent className={classes.paper}>
          <DialogContentText>Put in a reasonable name that will allow your friends to find.</DialogContentText>
          <TextField
            id="roomName"
            label="Room Name"
            onChange={handleRoomNameChange}
            autoComplete="off"
            autoFocus
            fullWidth/>
          <FormControlLabel label="Private Room?" control={
            <Switch checked={isPrivate} onChange={handlePrivate}/>
          }/>
          <TextField
            id="password"
            label="Password"
            type="password"
            disabled={!isPrivate}
            onChange={handlePasswordChange}
            autoComplete="off"
            autoFocus
            fullWidth/>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSubmit} color="primary" disabled={!roomName || (isPrivate && !password)}>Create</Button>
          <Button onClick={handleClose} color="secondary">Cancel</Button>
        </DialogActions>
      </Dialog>
    </div>
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