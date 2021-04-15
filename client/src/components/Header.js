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
import { apiOrigin } from '../lib/fetch';
import { getNameFromId } from '../lib/events';

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

function Header({ user, room }) {
  const loggedIn = !!user.id;
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

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
};

const mapStateToProps = (state) => ({
  room: state.room,
  user: state.user,
  roomName: state.room.name,
});

export default connect(mapStateToProps)(Header);
