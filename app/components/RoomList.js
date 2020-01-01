import React, { useState } from 'react';
import { connect } from 'react-redux';
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

const useStyles = makeStyles(theme => ({
  fab: {
    position: 'absolute',
    bottom: theme.spacing(2),
    right: theme.spacing(2)
  },
}));

const RoomList = ({ rooms, fetching }) => {
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
      <AddRoomFab />
    </Container>
  );
}

function Room (props) {
  const { room } = props;

  return (
    <ListItem
      button
    >
      <ListItemIcon>
        { room.private ?
          <PrivateIcon /> :
          <PublicIcon />
        }
      </ListItemIcon>
      <ListItemText primary={room.name}/>
    </ListItem>
  );  
}

function AddRoomFab (props) {
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
    fetch('/api/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: roomName,
        password: password
      })
    })
    .then(res => res.json())
    .then(data => {
      console.log(137, 'created room!', data)
      handleClose();
    }).catch(err => {
      console.error('Error when creating room: ', err);
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

// const mapDispatchToProps = (dispatch) => ({
//   fetchRooms: dispatch(fetchRooms()),
// });

export default connect(mapStateToProps)(RoomList);