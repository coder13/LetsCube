import React, { useEffect } from 'react';
import { connect } from 'react-redux';
import Container from '@material-ui/core/Container';
import Paper from '@material-ui/core/Paper';
import { fetchRoom } from '../store/room/actions';

/*
  GET room
  if there is no password, POS to the room to join it and start listening with socketio
  if there is a password:
    Present login screen, upon submission, send a POST to the room with the password
    If we get an error, return to / with notifcation about not being able to join room
    If no error, start listening with socketio
*/

let lastRoomId = null;
const Room = (props) => {
  const { dispatch, name, accessCode, match } = props;
  const { roomId } = match.params;

  useEffect(() => {
    if (roomId !== lastRoomId) {
      dispatch(fetchRoom(roomId))
      lastRoomId = roomId;
    }
  }, []);

  return (
    <Container>
      <Paper>
        <p>{name}</p>
        <p>{accessCode}</p>
      </Paper>
    </Container>
  );
}

// function Login (props) {
//   return (
//     <Container>
//         <Paper></Paper>
//     </Container>
//   );
// }

const mapStateToProps = (state) => ({
  ...state.room
})

export default connect(mapStateToProps)(Room);