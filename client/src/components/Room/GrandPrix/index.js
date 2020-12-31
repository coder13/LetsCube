import React, { useState } from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import Grid from '@material-ui/core/Grid';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import Paper from '@material-ui/core/Paper';
import BottomNavigation from '@material-ui/core/BottomNavigation';
import BottomNavigationAction from '@material-ui/core/BottomNavigationAction';
import Divider from '@material-ui/core/Divider';
import IconButton from '@material-ui/core/IconButton';
import ChatIcon from '@material-ui/icons/Chat';
import TimerIcon from '@material-ui/icons/Timer';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import Main from './GrandPrixMain';
import AdminToolbar from '../Common/AdminToolbar';
import UserToolbar from '../Common/UserToolbar';
import Chat from '../Panels/Chat';
import Leaderboard from './Leaderboard';
import RegisterPanel from './RegisterPanel';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
    margin: 'auto',
    width: '100%',
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
    display: 'flex',
    [theme.breakpoints.down('sm')]: {
      display: 'none',
    },
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  panel: {
    flexDirection: 'column',
    flexGrow: 1,
  },
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
  },
  toolbarContainer: {
    display: 'flex',
    flexDirection: 'row',
  },
  chatTitle: {
    flexGrow: 1,
  },
  floatingPanel: {
    position: 'fixed',
    right: 0,
  },
  registerPanel: {
    display: 'flex',
  },
}));

const panels = [{
  name: 'Timer',
  icon: <TimerIcon />,
}, {
  name: 'Leaderboard',
  icon: <ChatIcon />,
}, {
  name: 'Chat',
  icon: <ChatIcon />,
}];

export const GrandPrixRoom = ({ room, user }) => {
  const classes = useStyles();
  const [currentPanel, setCurrentPanel] = useState(0);
  const [chatVisible, setChatVisible] = useState(true);
  const started = room.startTime ? Date.now() > new Date(room.startTime).getTime() : true;

  const isAdmin = () => room.admin && room.admin.id === user.id;

  const handleChangePanel = (e, value) => {
    setCurrentPanel(+value);
  };

  return (
    <Paper className={classes.root}>
      <Paper
        className={classes.toolbarContainer}
        square
      >
        <UserToolbar />
        { isAdmin() && <AdminToolbar /> }
      </Paper>
      <Divider />

      <Grid container direction="row" className={classes.container}>
        {started ? (
          <>
            <Grid
              item
              className={clsx(classes.panel, classes.animateWidth, {
                [classes.hiddenOnMobile]: currentPanel !== 0,
              })}
              md={chatVisible ? 6 : 7}
            >
              <Main onlyShowSelf />
            </Grid>
            <Grid
              item
              className={clsx(classes.panel, classes.animateWidth, {
                [classes.hiddenOnMobile]: currentPanel !== 1,
              })}
              md={3}
            >
              <Leaderboard />
            </Grid>
          </>
        ) : (
          <Grid
            item
            xs={chatVisible ? 9 : 10}
            className={clsx(classes.panel, classes.animateWidth, classes.registerPanel, {
              [classes.hiddenOnMobile]: currentPanel === 2,
            })}
          >
            <RegisterPanel />
          </Grid>
        )}
        <Grid
          item
          className={clsx(classes.panel, classes.animateWidth, {
            [classes.hiddenOnMobile]: currentPanel !== 2,
            [classes.floatingPanel]: !chatVisible,
          })}
          md={chatVisible ? 3 : 1}
        >
          <AppBar position="static" color="transparent">
            <Toolbar variant="dense">
              <Typography className={classes.chatTitle}>
                Chat
              </Typography>
              <IconButton
                edge="end"
                onClick={() => setChatVisible(!chatVisible)}
              >
                {chatVisible ? <ArrowForwardIcon /> : <ArrowBackIcon /> }
              </IconButton>
            </Toolbar>
          </AppBar>
          { chatVisible && <Chat /> }
        </Grid>
      </Grid>

      <BottomNavigation
        value={currentPanel}
        showLabels
        onChange={(e, v) => handleChangePanel(e, v)}
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
};

GrandPrixRoom.propTypes = {
  room: PropTypes.shape({
    _id: PropTypes.string,
    private: PropTypes.bool,
    accessCode: PropTypes.string,
    name: PropTypes.string,
    admin: PropTypes.shape(),
    startTime: PropTypes.string,
  }),
  user: PropTypes.shape({
    id: PropTypes.number,
  }),
};

GrandPrixRoom.defaultProps = {
  room: {
    _id: undefined,
    private: false,
    accessCode: undefined,
    name: undefined,
    type: 'normal',
    startTime: undefined,
  },
  user: {
    id: undefined,
  },
};

const mapStateToProps = (state) => ({
  room: state.room,
  user: state.user,
});

export default connect(mapStateToProps)(GrandPrixRoom);
