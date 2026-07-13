import React from 'react';
import qs from 'qs';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import AppBar from '@material-ui/core/AppBar';
import Typography from '@material-ui/core/Typography';
import Toolbar from '@material-ui/core/Toolbar';
import IconButton from '@material-ui/core/IconButton';
import Avatar from '@material-ui/core/Avatar';
import Menu from '@material-ui/core/Menu';
import Button from '@material-ui/core/Button';
import MenuItem from '@material-ui/core/MenuItem';
import Badge from '@material-ui/core/Badge';
import { apiOrigin } from '../lib/fetch';
import { getNameFromId } from '../lib/events';
import NotificationsIcon from '@material-ui/icons/Notifications';

const useStyles = makeStyles(() => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflowY: 'auto',
  },
  title: {
    flexGrow: 1,
    minWidth: '6em',
  },
  titleLink: {
    color: 'inherit',
    textDecoration: 'none',
  },
  content: {
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  roomTitleGrid: {
    flexGrow: 1,
  },
}));

function Header({ user, room, notifications }) {
  const loggedIn = !!user.id;
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [notificationAnchorEl, setNotificationAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const closeNotifications = () => setNotificationAnchorEl(null);

  const login = () => {
    localStorage.setItem('letscube.redirect_uri', `${document.location.origin}/wca-redirect`);
    const url = `${process.env.REACT_APP_WCA_ORIGIN}/oauth/authorize?${qs.stringify({
      response_type: 'code',
      scope: 'public dob email',
      redirect_uri: `${document.location.origin}/wca-redirect`,
      client_id: process.env.REACT_APP_WCA_CLIENT_ID,
    })}`;
    window.location = url;
  };

  const logout = () => {
    window.location = `${apiOrigin || ''}/auth/logout?redirect=${document.location.origin}/`;
  };

  return (
    <AppBar position="relative" elevation={1}>
      <Toolbar>
        <Typography variant="h6" className={classes.title}>
          <Link to="/" className={classes.titleLink}>Let&apos;s Cube</Link>
        </Typography>
        <Grid className={classes.roomTitleGrid}>
          { room._id && (
            <>
              <Typography variant="h6" component="span">
                <Link to={`/rooms/${room._id}`} className={classes.titleLink}>{room.name}</Link>
              </Typography>
              <Typography variant="subtitle2" component="span" style={{ paddingLeft: '1em' }}>
                {getNameFromId(room.event)}
              </Typography>
            </>
          )}
        </Grid>

        { loggedIn
          ? (
            <div style={{ display: 'flex' }}>
              {notifications.enabled && (
                <>
                  <IconButton
                    aria-label="Notifications"
                    aria-controls="notification-menu"
                    aria-haspopup="true"
                    color="inherit"
                    onClick={(event) => setNotificationAnchorEl(event.currentTarget)}
                  >
                    <Badge badgeContent={notifications.unreadCount} color="secondary">
                      <NotificationsIcon />
                    </Badge>
                  </IconButton>
                  <Menu
                    anchorEl={notificationAnchorEl}
                    id="notification-menu"
                    keepMounted
                    onClose={closeNotifications}
                    open={Boolean(notificationAnchorEl)}
                  >
                    {notifications.notifications.length === 0 && <MenuItem disabled>No notifications</MenuItem>}
                    {notifications.notifications.slice(0, 5).map((notification) => (
                      <MenuItem
                        component={Link}
                        key={notification.id}
                        onClick={closeNotifications}
                        to="/notifications"
                      >
                        {notification.type === 'friend_request' ? 'Friend request' : 'Notification'}
                      </MenuItem>
                    ))}
                    <MenuItem component={Link} onClick={closeNotifications} to="/notifications">View all notifications</MenuItem>
                  </Menu>
                </>
              )}
              <IconButton onClick={handleMenu} color="inherit">
                <Avatar src={user.avatar.thumb_url} />
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                open={open}
                onClose={handleClose}
              >
                <MenuItem component={Link} to="/profile" variant="contained" color="primary">Profile</MenuItem>
                <MenuItem onClick={logout}>Log out</MenuItem>
              </Menu>
            </div>
          )
          : <Button color="inherit" onClick={login}>Login</Button>}
      </Toolbar>
    </AppBar>
  );
}

Header.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.number,
    name: PropTypes.string,
    wcaId: PropTypes.string,
    avatar: PropTypes.shape({
      thumb_url: PropTypes.string,
    }),
  }),
  room: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    event: PropTypes.string,
  }),
  notifications: PropTypes.shape({
    enabled: PropTypes.bool,
    notifications: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, type: PropTypes.string })),
    unreadCount: PropTypes.number,
  }),
};

Header.defaultProps = {
  user: {
    id: undefined,
    name: undefined,
    wcaId: undefined,
    avatar: {
      thumb_url: undefined,
    },
  },
  room: {
    _id: undefined,
    name: undefined,
    event: undefined,
  },
  notifications: {
    enabled: false,
    notifications: [],
    unreadCount: 0,
  },
};

const mapStateToProps = (state) => ({
  room: state.room,
  user: state.user,
  roomName: state.room.name,
  notifications: state.notifications,
});

export default connect(mapStateToProps)(Header);
