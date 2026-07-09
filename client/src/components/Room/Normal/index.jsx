import React, { useState } from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import BottomNavigation from '@material-ui/core/BottomNavigation';
import BottomNavigationAction from '@material-ui/core/BottomNavigationAction';
import Divider from '@material-ui/core/Divider';
import ChatIcon from '@material-ui/icons/Chat';
import TimerIcon from '@material-ui/icons/Timer';
import Main from '../Common/Main';
import Chat from '../Panels/Chat';
import AdminToolbar from '../Common/AdminToolbar';
import UserToolbar from '../Common/UserToolbar';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
    margin: 'auto',
    width: '100%',
    [theme.breakpoints.up('lg')]: {
      width: `${((10 / 12) * 100).toString()}%`,
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
    flexWrap: 'nowrap',
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

const panels = [{
  name: 'Timer',
  icon: <TimerIcon />,
}, {
  name: 'Chat',
  icon: <ChatIcon />,
}];

export const NormalRoom = ({ room, user }) => {
  const classes = useStyles();
  const [currentPanel, setCurrentPanel] = useState(0);

  const isAdmin = () => room.admin && room.admin.id === user.id;

  const handleChangePanel = (e, value) => {
    setCurrentPanel(value);
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
        <Grid
          item
          className={clsx(classes.panel, {
            [classes.hiddenOnMobile]: currentPanel !== 0,
          })}
          style={{
            flexGrow: 1,
          }}
        >
          <Main />
        </Grid>
        <Grid
          item
          className={clsx(classes.panel, {
            [classes.hiddenOnMobile]: currentPanel !== 1,
          })}
        >
          <Chat />
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

NormalRoom.propTypes = {
  room: PropTypes.shape({
    _id: PropTypes.string,
    private: PropTypes.bool,
    accessCode: PropTypes.string,
    name: PropTypes.string,
    admin: PropTypes.shape(),
  }),
  user: PropTypes.shape({
    id: PropTypes.number,
  }),
};

NormalRoom.defaultProps = {
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
};

const mapStateToProps = (state) => ({
  room: state.room,
  user: state.user,
});

export default connect(mapStateToProps)(NormalRoom);
