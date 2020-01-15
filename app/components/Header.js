import React from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom'
import { makeStyles } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Typography from '@material-ui/core/Typography';
import Toolbar from '@material-ui/core/Toolbar';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Avatar from '@material-ui/core/Avatar';

const useStyles = makeStyles(theme => ({
  root: {
    flexGrow: 1,
  },
  menuButton: {
    marginRight: theme.spacing(2),
  },
  title: {
    flexGrow: 1,
  },
  titleLink: {
    color: 'inherit',
    textDecoration: 'none',
  },
  roomName: {
    flexGrow: 1
  }
}));

function Header (props) {
  const { user, roomName } = props;
  const loggedIn = !!user.id;
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);

  const handleMenu = event => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const logout = () => {
    window.location = `/auth/logout?redirect=http://${document.location.host}/`;
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" className={classes.title}>
          <Link to="/" className={classes.titleLink}>Let's Cube</Link>
        </Typography>
        { roomName &&
          <Typography variant="h6" className={classes.roomName}>
            <Link to="/" className={classes.titleLink}>{roomName}</Link>
          </Typography>
        }

        { loggedIn ?
          <React.Fragment>
            <IconButton onClick={handleMenu} color="inherit" >
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
              onClose={handleClose}>
              <MenuItem component={Link} to="/preferences" variant="contained" color="primary">Preferences</MenuItem>
              <MenuItem onClick={logout}>LogOut</MenuItem>
            </Menu> 
          </React.Fragment>:
          <Button color="inherit" onClick={() => {
            window.location = `/auth/login?redirect=http://${document.location.host}/`
          }}>Login</Button>
        }
      </Toolbar>
    </AppBar>
  );
}

const mapStateToProps = (state) => ({
  roomName: state.room.name
});

export default connect(mapStateToProps)(Header)