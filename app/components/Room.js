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
import {
  fetchRoom,
  joinRoom,
  leaveRoom,
  submitResult,
} from '../store/room/actions';
import AdminToolbar from './AdminToolbar';
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

const flexMixin = (direction) => ({
  display: 'flex',
  flexGrow: 1,
  flexDirection: direction,
});

const useStyles = withStyles(theme => ({
  root: {
    background: '#ccc',
    ...flexMixin('column'),
    height: '~calc(100vh - 64px)'
  },
  paper: {
    padding: theme.spacing(0),
    borderColor: theme.divider,
    borderRadius: 0,
    flexGrow: 1,
    flexBasis: 'auto',
    // color: theme.palette.text.secondary,
  },
  center: {
    textAlign: 'center',
  },
  scramble: {
    margin: '.5em',
  },
  eventSelector: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  tableHeaderIndex: {
    width: '1em',
  },
  tableHeaderTime: {
    width: '1em',
  },
  tableResultCell: {
    width: '1em',
  },
  noClick: {
    cursor: 'initial',
  },
  tableContainer: {
    height: '100%',
  },
  table: {
    padding: 'none',
    display: 'flex',
    flexFlow: 'column',
    height: '100%',
    width: '100%',
  },
  thead: {
    display: 'table',
    tableLayout: 'fixed',
    flex: '0 0 auto',
    width: '~"calc(100% - 0.9em)"'
  },
  tbody: {
    flex: '1 1 auto',
    display: 'block',
    overflowY: 'scroll',
  },
  tr: {
    display: 'table',
    tableLayout: 'fixed',
    width: '100%',
  }
}));

class Room extends React.Component {
  displayName: 'Room'

  constructor (props) {
    super(props);
    const { dispatch, match, room, roomCode } = this.props;
    this.tableBodyRef = React.createRef();
    
    if (!room._id) {
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
    const { dispatch, room, user } = this.props;
    if (!room.attempts.length) {
      console.error('No attempt with which to submit time!');
      return;
    }

    // Don't even bother sending the result.
    if (!user.id) {
      return;
    }

    const latestAttempt = room.attempts ? room.attempts[room.attempts.length - 1] : {};
    dispatch(submitResult({
      id: latestAttempt.id,
      result: {
        time: event.time,
      }
    }));
  }

  isAdmin () {
    return this.props.room && this.props.user && this.props.room.admin.id === this.props.user.id;
  }

  eventChanged () {
    // todo
  }
  
  render () {
    if (!this.props.room || !this.props.roomCode || this.props.fetching) {
      return this.renderLoadingRoom();
    }
    
    const { dispatch, classes, room, user } = this.props;
    const { users, attempts } = room;
    const latestAttempt = (attempts && attempts.length) ? attempts[attempts.length - 1] : {};
    const scrambles = latestAttempt.scrambles ? latestAttempt.scrambles.join(', ') : 'No Scrambles';
    const timerDisabled = !!(user && scrambles && latestAttempt.results && latestAttempt.results[user.id]);

    if (this.tableBodyRef.current) {
      // scrolls the times.
      this.tableBodyRef.current.scrollTop = 0;
    }

    return (
      <div className={classes.root}>
        <Grid container justify="center" style={flexMixin('row')}>
          <Grid item xs={12} sm={12} md={12} lg={10} style={flexMixin('column')}>
            <Paper className={classes.paper} elevation={1} style={{...flexMixin('column')}}>
              { this.isAdmin() ?
                <div style={{
                  flex: 0
                }}>
                  <AdminToolbar dispatch={dispatch} room={room}/>
                  <Divider/>
                </div> : <br/>}

              <div className={classes.center}  style={{
                  flex: 0
                }}>
                <Typography variant="subtitle2" className={classes.scramble}>{scrambles}</Typography>
                <Divider />
                <Timer
                  disabled={timerDisabled}
                  onStatusChange={this.onStatusChange}
                  onSubmitTime={this.onSubmitTime.bind(this)}
                  />
                <Divider />
              </div>

              
              <TableContainer className={classes.tableContainer} style={{
                flexGrow: 1,
                display: 'flex',
                height: '200px'
              }}>
                <Table stickyHeader className={classes.table} size="small">
                  <TableHead className={classes.thead}>
                    <TableRow className={classes.tr}>
                      <TableCell align="left" className={classes.tableHeaderIndex}>#</TableCell>
                      {users.map((user, index) =>
                        <TableCell key={index} align="left" className={classes.tableHeaderTime}>
                          {user.username || user.name}
                        </TableCell>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody className={classes.tbody} ref={this.tableBodyRef}>
                    {[...attempts].reverse().map((attempt,i) => (
                      <TableRow className={classes.tr} key={i}>
                        <TableCell className={classes.tableResultCell} align="left">{attempts.length - i}</TableCell>
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
  roomCode: state.socket.room, // this tells us that we're actually in the room
  user: state.user,
})

export default connect(mapStateToProps)(useStyles(Room));