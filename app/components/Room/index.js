import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import BottomNavigation from '@material-ui/core/BottomNavigation';
import BottomNavigationAction from '@material-ui/core/BottomNavigationAction';
import ChatIcon from '@material-ui/icons/Chat';
import TimerIcon from '@material-ui/icons/Timer';
import Login from './Login';
import Main from './Main';
import Chat from './Chat';
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

const foos = [];
for (let i = 0; i < 100; i += 1) {
  foos.push('foo');
}

const panels = [{
  name: 'Timer',
  component: <Main />,
  icon: <TimerIcon />,
}, {
  name: 'Chat',
  component: <Chat />,
  icon: <ChatIcon />,
}];
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
  bottomNav: {
    width: '100%',
    height: '4em',
    flexGrow: 0,
    backgroundColor: '#e6e6e6',
  },
  bottomNavItem: {
    display: 'flex',
    flexGrow: 1,
    maxWidth: '100%',
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

    this.state = {
      currentPanel: 0,
    };

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

  handleChangePanel(e, value) {
    this.setState({
      currentPanel: value,
    });
  }

  render() {
    const {
      classes, fetching, inRoom, room,
    } = this.props;

    const { currentPanel } = this.state;

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
        { !loggedIn ? <Login /> : panels[currentPanel].component }
        <BottomNavigation
          value={currentPanel}
          showLabels
          onChange={(e, v) => this.handleChangePanel(e, v)}
          className={classes.bottomNav}
        >
          {panels.map((panel, index) => (
            <BottomNavigationAction
              key={panel.name}
              className={classes.bottomNavItem}
              label={panel.name}
              value={index}
              icon={panel.icon}
            />
          ))}
        </BottomNavigation>
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
