import React, { Component } from 'react';
import Container from '@material-ui/core/Container';
import Paper from '@material-ui/core/Paper';

/*
  GET room
  if there is no password, POS to the room to join it and start listening with socketio
  if there is a password:
    Present login screen, upon submission, send a POST to the room with the password
    If we get an error, return to / with notifcation about not being able to join room
    If no error, start listening with socketio
*/

class Room extends Component {
  state = {
    room: null,
    loading: true,
    authenticated: null // if password is true, this will be false until a password is given
  }

  componentDidMount () {
    const { roomId } = this.props.match.params;

    fetch(`/api/room/${roomId}`)
      .then(data => data.json())
      .then(room => {
        this.setState({
          loading: false,
          room: room,
          authenticated: !room.password
        })
      })
  }

  render () {
    return (
      <Container>
        <Paper></Paper>
      </Container>
    )
  }
}

// function Login (props) {
//   return (
//     <Container>
//         <Paper></Paper>
//     </Container>
//   );
// }

export default Room;