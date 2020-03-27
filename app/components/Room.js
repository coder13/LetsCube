import React from 'react';
import { withStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
// import { AutoSizer, Column, Table } from 'react-virtualized';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import Divider from '@material-ui/core/Divider';
import TableContainer from '@material-ui/core/TableContainer';
import Table from '@material-ui/core/Table';
import TableHead from '@material-ui/core/TableHead';
import TableBody from '@material-ui/core/TableBody';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import { fetchRoom, joinRoom, leaveRoom, submitResult } from '../store/room/actions';
import Timer from './Timer';
import { formatTime } from '../lib/utils';

/*
  GET room
  if there is no password, POS to the room to join it and start listening with socketio
  if there is a password:
    Present login screen, upon submission, send a POST to the room with the password
    If we get an error, return to / with notifcation about not being able to join room
    If no error, start listening with socketio
*/

const useStyles = withStyles(theme => ({
  root: {
    flexGrow: 1,
  },
  paper: {
    padding: theme.spacing(0),
    color: theme.palette.text.secondary,
  },
  center: {
    textAlign: 'center',
  },
  tableContainer: {
    maxHeight: '250px',
  },
  table: {
    padding: 'none',
  },
  tableHeaderIndex: {
    width: '1em',
  },
  tableHeaderTime: {
    width: '12px',
    maxWidth: '12px',
  },
  noClick: {
    cursor: 'initial',
  },
}));

class Room extends React.Component {
  displayName: 'Room'

  componentDidMount () {
    const { dispatch, match, room, roomCode } = this.props;
    
    if (!room.id) {
      dispatch(fetchRoom(match.params.roomId));
    }

    if (!roomCode && room.accessCode) {
      dispatch(joinRoom(room.accessCode))
    }
  }

  componentDidUpdate (prevProps) {
    const { dispatch, room, roomCode } = this.props;

    if (!roomCode && room.accessCode) {
      dispatch(joinRoom(room.accessCode))
    }
  }

  componentWillUnmount () {
    const { dispatch, room, roomCode } = this.props;

    if (roomCode && room.accessCode) {
      dispatch(leaveRoom())
    }
  }

  onStatusChange () {

  }

  onSubmitTime (event) {
    const { dispatch, room } = this.props;
    const latestAttempt = room.attempts ? room.attempts[room.attempts.length - 1] : {};
    dispatch(submitResult({
      id: latestAttempt.id,
      result: {
        time: event.time,
      }
    }));
  }

  render () {
    console.log(this.props.room);
    if (!this.props.room || !this.props.roomCode || this.props.fetching) {
      return this.renderLoadingRoom();
    }

    const { classes, room } = this.props;
    const { users, attempts } = room;
    const latestAttempt = (attempts && attempts.length) ? attempts[attempts.length - 1] : {};
    const scrambles = latestAttempt.scrambles ? latestAttempt.scrambles.join(', ') : 'No Scrambles';

    return (
      <div className={classes.root}>        
          <Grid container justify="center">
            <Grid item xs={12} sm={10} md={10} lg={10}>
              <Paper className={classes.paper}>
                <div className={classes.center}>
                  <Typography variant="subtitle2">&nbsp;</Typography>
                  <Typography variant="subtitle2">{scrambles}</Typography>
                  <Typography variant="subtitle2">&nbsp;</Typography>
                  <Divider />
                  <Timer
                    onStatusChange={this.onStatusChange}
                    onSubmitTime={this.onSubmitTime.bind(this)}
                  />
                  <Divider />
                </div>

                <TableContainer className={classes.tableContainer}>
                  <Table className={classes.table} size="small">
                    <TableHead>
                      <TableRow className={classes.tableRow}>
                        <TableCell align="left" className={classes.tableHeaderIndex}>#</TableCell>
                        {users.map((user, index) =>
                          <TableCell key={index} align="left" className={classes.tableHeaderTime}>
                            {user.username || user.name}
                          </TableCell>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {attempts.map((attempt,i) => (
                        <TableRow className={classes.tableRow} key={i}>
                          <TableCell className={classes.tableResultCell} align="left">{i + 1}</TableCell>
                          {users.map((user, j) =>
                            <TableCell key={j} className={classes.tableResultCell} align="left">
                              {attempt.results[user.id] ? formatTime(attempt.results[user.id].time) : ''}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>

      </div>
    );
  }

  renderLoadingRoom () {
    return (<div>
      Fetching...

    </div>)
  }
}

// function Login (props) {
//   return (
//     <Container>
//         <Paper></Paper>
//     </Container>
//   );
// }

const mapStateToProps = (state) => ({
  room: state.room,
  connected: state.socket.connected,
  roomCode: state.socket.room,
})

export default connect(mapStateToProps)(useStyles(Room));