import React, { useState } from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { makeStyles } from '@mui/styles';
import { connect } from 'react-redux';
import Paper from '@mui/material/Paper';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Divider from '@mui/material/Divider';
import ChatIcon from '@mui/icons-material/Chat';
import TimerIcon from '@mui/icons-material/Timer';
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
    display: 'flex',
    flexGrow: 1,
    flexWrap: 'nowrap',
    minHeight: 0,
  },
  mainPanel: {
    display: 'flex',
    flex: '1 1 auto',
    minWidth: 0,
  },
  chatPanel: {
    display: 'flex',
    flex: '0 0 24rem',
    minWidth: 0,
    transition: theme.transitions.create('flex-basis'),
    [theme.breakpoints.down('sm')]: {
      flexBasis: '100%',
    },
  },
  chatPanelClosed: {
    flexBasis: '3rem',
    [theme.breakpoints.down('sm')]: {
      flexBasis: '100%',
    },
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
  const [chatOpen, setChatOpen] = useState(true);

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

      <div className={classes.container}>
        <div
          className={clsx(classes.mainPanel, {
            [classes.hiddenOnMobile]: currentPanel !== 0,
          })}
        >
          <Main />
        </div>
        <div
          className={clsx(classes.chatPanel, {
            [classes.hiddenOnMobile]: currentPanel !== 1,
            [classes.chatPanelClosed]: !chatOpen,
          })}
        >
          <Chat open={chatOpen} onToggle={() => setChatOpen((isOpen) => !isOpen)} />
        </div>
      </div>

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
