import React from 'react';
import PropTypes from 'prop-types';
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
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import {
  fetchRoom,
  joinRoom,
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

const useStyles = withStyles((theme) => ({
  root: {
    ...flexMixin('column'),
    height: '~calc(100vh - 64px)',
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
    boxShadow: theme.shadows[1],
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
  },
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
  },
}));

class Room extends React.Component {
  constructor(props) {
    super(props);
    const {
      dispatch, match, room, inRoom,
    } = this.props;
    this.tableBodyRef = React.createRef();

    this.state = {
      password: '',
    };

    if (!room._id) {
      dispatch(fetchRoom(match.params.roomId));
    }

    if (!inRoom && room.accessCode) {
      dispatch(joinRoom(room._id));
    }
  }

  componentDidUpdate() {
    const { dispatch, room, inRoom } = this.props;
    const { password } = this.state;

    // inRoom means we're not connected to a room
    if (!inRoom && room.accessCode) {
      dispatch(joinRoom(room._id, password));
    }
  }

  onSubmitTime(event) {
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
        penalties: event.penalties,
      },
    }));
  }

  isAdmin() {
    const { room, user } = this.props;

    return room.admin.id === user.id;
  }

  renderLogin() {
    const {
      dispatch, classes, room, loginFailed,
    } = this.props;
    const { password } = this.state;

    // Forgive me lord
    if (loginFailed && password && !this.resetPassword) {
      this.setState({
        password: '',
      });

      this.resetPassword = true;
    }

    const login = (event) => {
      event.preventDefault();
      this.resetPassword = false;
      dispatch(joinRoom(room._id, password));
    };

    const updatePassword = (event) => {
      this.setState({
        password: event.target.value,
      });
    };

    return (
      <div className={classes.root}>
        <Grid container justify="center" style={flexMixin('row')}>
          <Grid item xs={12} sm={12} md={12} lg={10} style={flexMixin('column')}>
            <Paper
              className={classes.paper}
              elevation={1}
              style={{
                padding: '1em',
                paddingTop: '10em',
              }}
            >
              <Paper
                elevation={2}
                style={{
                  padding: '1em',
                  width: '320px',
                  margin: 'auto',
                }}
              >
                <form
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                  onSubmit={login}
                >
                  <TextField
                    label="Password"
                    type="password"
                    autoFocus
                    helperText="Enter password to login"
                    value={password}
                    onChange={updatePassword}
                  />
                  <Button
                    variant="contained"
                    style={{ margin: '1em' }}
                    onClick={login}
                  >
Log in
                  </Button>
                </form>
              </Paper>
            </Paper>
          </Grid>
        </Grid>
      </div>
    );
  }

  render() {
    const {
      dispatch, classes, inRoom, room, user,
    } = this.props;

    if (room.private && !inRoom) {
      return this.renderLogin();
    }

    if (!inRoom) {
      return (
        <Backdrop open>
          <CircularProgress color="inherit" />
        </Backdrop>
      );
    }


    const { users, attempts } = room;
    const latestAttempt = (attempts && attempts.length) ? attempts[attempts.length - 1] : {};
    const scrambles = latestAttempt.scrambles ? latestAttempt.scrambles.join(', ') : 'No Scrambles';
    const timerDisabled = !!(latestAttempt.results && latestAttempt.results[user.id]);

    if (this.tableBodyRef.current) {
      // scrolls the times.
      this.tableBodyRef.current.scrollTop = 0;
    }

    const sum = (a, b) => a + b;
    const mapToTime = (userId) => (i) => (i.results[userId]
      && !(i.results[userId].penalties && i.results[userId].penalties.DNF)
      ? i.results[userId].time : -1);

    const ao5 = (userId) => {
      if (!attempts || !attempts.length) {
        return undefined;
      }

      const last5 = (latestAttempt.results[userId]
        ? attempts.slice(-5) : attempts.slice(-6, -1)).map(mapToTime(userId));

      if (last5.length < 5) {
        return 0;
      } if (last5.indexOf(-1) > -1) {
        last5.splice(last5.indexOf(-1), 1);
        if (last5.indexOf(-1) > -1) {
          return -1; // DNF avg
        }

        return (last5.reduce(sum) - Math.min(...last5)) / 3;
      }

      return (last5.reduce(sum) - Math.min(...last5) - Math.max(...last5)) / 3;
    };

    return (
      <div className={classes.root}>
        <Grid container justify="center" style={flexMixin('row')}>
          <Grid item xs={12} sm={12} md={12} lg={10} style={flexMixin('column')}>
            <Paper className={classes.paper} elevation={1} style={{ ...flexMixin('column') }}>
              { this.isAdmin()
                ? (
                  <div style={{
                    flex: 0,
                    connected: false,
                  }}
                  >
                    <AdminToolbar dispatch={dispatch} room={room} />
                    <Divider />
                  </div>
                ) : <br />}

              <div
                className={classes.center}
                style={{
                  flex: 0,
                }}
              >
                <Typography variant="subtitle2" className={classes.scramble}>{scrambles}</Typography>
                <Divider />
                <Timer
                  disabled={timerDisabled}
                  onStatusChange={this.onStatusChange}
                  onSubmitTime={(e) => this.onSubmitTime(e)}
                  useInspection="false"
                />
                <Divider />
              </div>

              <TableContainer
                className={classes.tableContainer}
                style={{
                  flexGrow: 1,
                  display: 'flex',
                  height: '20px',
                }}
              >
                <Table stickyHeader className={classes.table} size="small">
                  <TableHead className={classes.thead}>
                    <TableRow className={classes.tr}>
                      <TableCell align="left" className={classes.tableHeaderIndex}>#</TableCell>
                      {users.map((u) => (
                        <TableCell key={u.id} align="left" className={classes.tableHeaderTime}>
                          <span>{u.username || u.name}</span>
                          <br />
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow className={classes.tr} key={-1}>
                      <TableCell className={classes.tableResultCell} align="left">ao5</TableCell>
                      {users.map((u) => (
                        <TableCell key={u.id} className={classes.tableResultCell} align="left">
                          <span>{formatTime(ao5(u.id)).toString()}</span>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody className={classes.tbody} ref={this.tableBodyRef}>
                    {[...attempts].reverse().map((attempt, index) => {
                      const results = users
                        .map((u) => (attempt.results[u.id]
                          && (attempt.results[u.id].penaltile
                            && !attempt.results[u.id].penaltiles.DNF)
                          ? attempt.results[u.id].time : undefined))
                        .filter((r) => !!r && r > -1);
                      const best = Math.min(...results);

                      return (
                        <TableRow className={classes.tr} key={attempt.id}>
                          <TableCell className={classes.tableResultCell} align="left">{attempts.length - index}</TableCell>
                          {users.map((u) => (
                            <TableCell key={u.id} className={classes.tableResultCell} align="left">
                              {attempt.results[u.id]
                                ? (
                                  <span style={{
                                    color: attempt.results[u.id].time === best ? 'red' : 'black',
                                  }}
                                  >
                                    {formatTime(
                                      attempt.results[u.id].time,
                                      attempt.results[u.id].penalties,
                                    )}
                                  </span>
                                ) : ''}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </div>
    );
  }
}

Room.propTypes = {
  room: PropTypes.shape({
    _id: PropTypes.string,
    private: PropTypes.bool,
    accessCode: PropTypes.string,
    users: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.number,
    })),
    attempts: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.number,
    })),
    admin: PropTypes.shape({
      id: PropTypes.number,
    }),
  }),
  user: PropTypes.shape({
    id: PropTypes.number,
  }),
  inRoom: PropTypes.bool,
  loginFailed: PropTypes.bool,
  dispatch: PropTypes.func.isRequired,
  match: PropTypes.shape().isRequired,
  classes: PropTypes.shape().isRequired,
};

Room.defaultProps = {
  room: {
    _id: undefined,
    private: false,
    accessCode: undefined,
    users: [],
    attempts: [],
    admin: {
      id: undefined,
    },
  },
  user: {
    id: undefined,
  },
  inRoom: false,
  loginFailed: false,
};

const mapStateToProps = (state) => ({
  room: state.room,
  inRoom: !!state.socket.room, // this tells us that we're actually in the room
  loginFailed: state.socket.loginFailed,
  user: state.user,
});

export default connect(mapStateToProps)(useStyles(Room));
