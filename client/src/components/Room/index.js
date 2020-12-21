import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import Paper from '@material-ui/core/Paper';
import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import Login from './Common/Login';
import {
  fetchRoom,
  joinRoom,
} from '../../store/room/actions';

import Normal from './Normal';
import GrandPrix from './GrandPrix';

const useStyles = withStyles((theme) => ({
  root: {
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
    margin: 'auto',
    width: '100%',
    [theme.breakpoints.up('lg')]: {
      width: '83.333333%',
    },
  },
}));

class Room extends React.Component {
  constructor(props) {
    super(props);
    const {
      dispatch, match, room, inRoom,
    } = this.props;

    if (!room._id) {
      dispatch(fetchRoom(match.params.roomId));
    }

    if (!inRoom && room.accessCode) {
      dispatch(joinRoom(room._id));
    }

    if (room.name) {
      document.title = `${room.name} - Let's Cube`;
    }
  }

  componentDidUpdate() {
    const { dispatch, room, inRoom } = this.props;

    // inRoom means we're connected to a room
    if (!inRoom && room.accessCode) {
      // request to join the room
      dispatch(joinRoom(room._id));
    }

    if (room.name) {
      document.title = `${room.name} - Let's Cube`;
    }
  }

  renderRoom() {
    const { room } = this.props;

    if (room.type === 'grand_prix') {
      return <GrandPrix room={room} />;
    }

    return <Normal room={room} />;
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

    if (loggedIn) {
      return this.renderRoom();
    }

    return (
      <Paper className={classes.root}>
        <Login />
      </Paper>
    );
  }
}

Room.propTypes = {
  fetching: PropTypes.bool,
  room: PropTypes.shape({
    _id: PropTypes.string,
    private: PropTypes.bool,
    accessCode: PropTypes.string,
    name: PropTypes.string,
    admin: PropTypes.shape(),
    type: PropTypes.oneOf(['normal', 'grand_prix']),
  }),
  user: PropTypes.shape({
    id: PropTypes.number,
  }),
  inRoom: PropTypes.bool,
  dispatch: PropTypes.func.isRequired,
  match: PropTypes.shape().isRequired,
  classes: PropTypes.shape().isRequired,
};

Room.defaultProps = {
  fetching: true,
  room: {
    _id: undefined,
    private: false,
    accessCode: undefined,
    name: undefined,
    type: 'normal',
  },
  user: {
    id: undefined,
  },
  inRoom: false,
};

const mapStateToProps = (state) => ({
  fetching: state.room.fetching,
  room: state.room,
  inRoom: !!state.socket.room, // this tells us that we're actually in the room
  user: state.user,
});

export default connect(mapStateToProps)(useStyles(Room));
