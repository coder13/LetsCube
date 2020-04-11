import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import Grid from '@material-ui/core/Grid';
import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import Login from './Login';
import Main from './Main';
import {
  fetchRoom,
  joinRoom,
} from '../../store/room/actions';

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
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
    height: '~calc(100vh - 64px)',
  },
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
  },
}));

class RoomNav extends React.Component {
  constructor(props) {
    super(props);
    const {
      dispatch, match, room, inRoom,
    } = this.props;
    this.tableBodyRef = React.createRef();

    if (!room._id) {
      dispatch(fetchRoom(match.params.roomId));
    }

    if (!inRoom && room.accessCode) {
      dispatch(joinRoom(room._id));
    }
  }

  componentDidUpdate() {
    const { dispatch, room, inRoom } = this.props;

    // inRoom means we're not connected to a room
    if (!inRoom && room.accessCode) {
      dispatch(joinRoom(room._id));
    }
  }

  render() {
    const {
      classes, fetching, inRoom, room,
    } = this.props;

    const loggedIn = !room.private || inRoom;

    if (fetching) {
      return (
        <Backdrop open>
          <CircularProgress color="inherit" />
        </Backdrop>
      );
    }

    return (
      <div className={classes.root}>
        <Grid container justify="center" style={flexMixin('row')}>
          <Grid item xs={12} sm={12} md={12} lg={10} style={flexMixin('column')}>
            { loggedIn ? <Main /> : <Login roomId={room._id} /> }
          </Grid>
        </Grid>
      </div>
    );
  }
}

RoomNav.propTypes = {
  fetching: PropTypes.bool,
  room: PropTypes.shape({
    _id: PropTypes.string,
    private: PropTypes.bool,
    accessCode: PropTypes.string,
  }),
  inRoom: PropTypes.bool,
  dispatch: PropTypes.func.isRequired,
  match: PropTypes.shape().isRequired,
  classes: PropTypes.shape().isRequired,
};

RoomNav.defaultProps = {
  fetching: true,
  room: {
    _id: undefined,
    private: false,
    accessCode: undefined,
  },
  inRoom: false,
};

const mapStateToProps = (state) => ({
  fetching: state.room.fetching,
  room: state.room,
  inRoom: !!state.socket.room, // this tells us that we're actually in the room
  user: state.user,
});

export default connect(mapStateToProps)(useStyles(RoomNav));
