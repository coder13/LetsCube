import React from 'react';
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
import Drawer from '@material-ui/core/Drawer';
import Divider from '@material-ui/core/Divider';
import List from '@material-ui/core/List';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Menu from '@material-ui/core/Menu';
import Button from '@material-ui/core/Button';
import MenuItem from '@material-ui/core/MenuItem';
import AppsIcon from '@material-ui/icons/Apps';
import ListItemLink from './ListItemLink';
import { getNameFromId } from '../lib/wca';

const drawerWidth = 240;

const useStyles = makeStyles((theme) => ({
  title: {
    flexGrow: 1,
  },
  titleLink: {
    color: 'inherit',
    textDecoration: 'none',
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
  },
  appBarShift: {
    width: `calc(100% - ${drawerWidth}px)`,
    marginLeft: drawerWidth,
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  drawer: {
    width: drawerWidth,
    flexShrink: 0,
  },
  drawerPaper: {
    width: drawerWidth,
  },
  drawerHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 1),
    // necessary for content to be below app bar
    ...theme.mixins.toolbar,
    justifyContent: 'flex-end',
  },
  content: {
    display: 'flex',
    flexGrow: 1,
    height: '100vh',
    flexDirection: 'column',
  },
  toolbarFix: {
    minHeight: '64px',
  },
  roomTitleGrid: {
    flexGrow: 1,
  },
}));

function Header({ children, user, room }) {
  const loggedIn = !!user.id;
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const open = Boolean(anchorEl);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const login = () => {
    window.location = `/auth/login?redirect=${document.location.href}`;
  };

  const logout = () => {
    console.log(document.location.origin);
    window.location = `/auth/logout?redirect=${document.location.origin}/`;
  };

  return (
    <div style={{ display: 'flex' }}>
      <AppBar position="fixed">
        <Toolbar>
          <Typography variant="h6" className={classes.title}>
            <Link to="/" className={classes.titleLink}>Let&apos;s Cube</Link>
          </Typography>
          {/* <IconButton color="inherit" edge="start" onClick={() => setDrawerOpen(true)}>
            <MenuIcon/>
          </IconButton> */}
          <Grid className={classes.roomTitleGrid}>
            { room._id
              ? (
                <>

                  <Typography variant="h6">
                    <Link to={`/rooms/${room._id}`} className={classes.titleLink}>{room.name}</Link>
                  </Typography>
                  <Typography variant="caption">
                    {getNameFromId(room.event)}
                  </Typography>
                </>
              ) : ''}
          </Grid>

          { loggedIn
            ? (
              <>
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
                  <MenuItem component={Link} to="/preferences" variant="contained" color="primary">Preferences</MenuItem>
                  <MenuItem onClick={logout}>Log out</MenuItem>
                </Menu>
              </>
            )
            : <Button color="inherit" onClick={login}>Login</Button>}
        </Toolbar>
      </AppBar>
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        className={classes.drawer}
        classes={{
          paper: classes.drawerPaper,
        }}
      >
        <div className={classes.toolbarFix} />
        <List>
          <Divider />
          <ListItemLink to="/" key="home">
            <ListItemIcon><AppsIcon /></ListItemIcon>
            <ListItemText>Home</ListItemText>
          </ListItemLink>
        </List>
      </Drawer>
      <main className={classes.content}>
        <div className={classes.toolbarFix} />
        {children}
      </main>
    </div>
  );
}

Header.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.number,
    avatar: PropTypes.shape({
      thumb_url: PropTypes.string,
    }),
  }),
  room: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    event: PropTypes.string,
  }),
  children: PropTypes.element.isRequired,
};

Header.defaultProps = {
  user: {
    id: undefined,
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
  roomName: state.room.name,
});

export default connect(mapStateToProps)(Header);
