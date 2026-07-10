import React, { useState } from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { makeStyles } from '@mui/styles';
import { connect } from 'react-redux';
import Grid from '@mui/material/Grid';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ChatIcon from '@mui/icons-material/Chat';
import TimerIcon from '@mui/icons-material/Timer';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
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
  const startTimeUnix = room.startTime ? new Date(room.startTime).getTime() : 0;
  const [started, setStarted] = useState(Date.now() > startTimeUnix);

  React.useEffect(() => {
    let timerObj = null;

    setStarted(Date.now() > startTimeUnix);

    if (startTimeUnix > Date.now()) {
      timerObj = setTimeout(() => {
        setStarted(true);
      }, startTimeUnix - Date.now());
    }

    return () => {
      clearTimeout(timerObj);
    };
  }, [startTimeUnix]);

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
