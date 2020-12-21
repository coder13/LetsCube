import React from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import BottomNavigation from '@material-ui/core/BottomNavigation';
import BottomNavigationAction from '@material-ui/core/BottomNavigationAction';
import Divider from '@material-ui/core/Divider';
import Login from './Common/Login';
import Chat from './Common/Chat';
import AdminToolbar from './Common/AdminToolbar';
import UserToolbar from './Common/UserToolbar';
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
  bottomNav: {
    width: '100%',
    height: '4em',
    flexGrow: 0,
    backgroundColor: theme.palette.background.default,
    [theme.breakpoints.up('md')]: {
      display: 'none',
    },
  },
  bottomNavItem: {
    display: 'flex',
    flexGrow: 1,
    maxWidth: '100%',
  },
  hiddenOnMobile: {
    [theme.breakpoints.down('sm')]: {
      display: 'none',
    },
  },
  container: {
    flexGrow: 1,
  },
  panel: {
    flexGrow: 1,
    transition: `display 5s ${theme.transitions.easing.easeInOut}`,
  },
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
  },
  toolbarContainer: {
    display: 'flex',
    flexDirection: 'row',
  },
}));

const panels = [];

class Room extends React.Component {
  constructor(props) {
    super(props);
    const {
      dispatch, match, room, inRoom,
    } = this.props;

    this.state = {
      currentPanel: 0,
    };

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

  isAdmin() {
    const { room, user } = this.props;
    return room.admin && room.admin.id === user.id;
  }

  handleChangePanel(e, value) {
    this.setState({
      currentPanel: value,
    });
  }

  renderRoom() {
    const { room } = this.props;

    if (room.type === 'grand_prix') {
      return <GrandPrix room={room} />;
    }

    return <Normal room={room} />;
  }

  renderLoggedIn() {
    const { classes } = this.props;

    const { currentPanel } = this.state;

    return (
      <Paper className={classes.root}>
        <Paper
          className={classes.toolbarContainer}
          square
        >
          <UserToolbar />
          { this.isAdmin() && <AdminToolbar /> }
        </Paper>
        <Divider />
        <Grid container direction="row" className={classes.container}>
          <Grid
            item
            className={clsx(classes.panel, {
              [classes.hiddenOnMobile]: currentPanel !== 0,
            })}
            md={8}
          >
            { this.renderRoom() }
          </Grid>
          <Grid
            item
            className={clsx(classes.panel, {
              [classes.hiddenOnMobile]: currentPanel !== 1,
            })}
            md={4}
          >
            <Chat />
          </Grid>
        </Grid>
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
      </Paper>
    );
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

    return (loggedIn ? this.renderLoggedIn()
      : (
        <Paper className={classes.root}>
          <Login />
        </Paper>
      )
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
