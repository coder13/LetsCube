import React from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom'
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
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import AppsIcon from '@material-ui/icons/Apps';
import MenuIcon from '@material-ui/icons/Menu';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import NavigateNextIcon from '@material-ui/icons/NavigateNext';
import {
  leaveRoom,
  deleteRoom,
  requestNewScramble,
} from '../store/room/actions';

const drawerWidth = 240;

const useStyles = makeStyles(theme => ({
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
    flexGrow: 1,
  },
  toolbarFix: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: theme.spacing(0, 1),
    // necessary for content to be below app bar
    ...theme.mixins.toolbar,
  },
}));

function ListItemLink(props) {
  return <ListItem button component={Link} {...props} />;
}

function Header (props) {
  const { dispatch, user, room } = props;
  const loggedIn = !!user.id;
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const open = Boolean(anchorEl);
  const isAdmin = () => room.admin && user.id && room.admin.id === user.id;

  const handleMenu = event => {
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

  const handleDeleteRoom = () => {
    if (isAdmin()){
      dispatch(deleteRoom(room.id));
    }
  }

  const handleNewScramble = () => {
    dispatch(requestNewScramble());
  }

  const handleLeaveRoom = () => {
    dispatch(leaveRoom());
  }

  console.log(drawerOpen);

  return (
    <div style={{display: 'flex'}}>
      <AppBar position="fixed">
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setDrawerOpen(true)}>
            <MenuIcon/>
          </IconButton>
          <Grid container justify="center" style={{alignItems: 'center'}}>
            { room ?
              <Typography variant="h6" className={classes.title}>
                <Link to={'/rooms/' + room.id} className={classes.titleLink}>{room.name}</Link>
              </Typography> : 
              <Typography variant="h6" className={classes.title}>
                <Link to="/" className={classes.titleLink}>Let's Cube</Link>
              </Typography>
            }
          </Grid>

          { room.id &&
            <IconButton onClick={handleLeaveRoom} color="inherit" >
              <ExitToAppIcon/>
            </IconButton>
          }

          { isAdmin() ?
            <React.Fragment>
              <IconButton onClick={handleNewScramble} color="inherit" >
                <NavigateNextIcon/>
              </IconButton>
              <IconButton onClick={handleMenu} color="inherit" >
                <MoreVertIcon/>
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
                <MenuItem onClick={handleDeleteRoom}>Delete Room</MenuItem>
              </Menu> 
            </React.Fragment> : ''
          }
        </Toolbar>
      </AppBar>
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        className={classes.drawer}
        classes={{
          paper: classes.drawerPaper
        }}
      >
        <List>
          { loggedIn ?
            <React.Fragment>
              <ListItem key="avatar">
                <ListItemIcon><Avatar src={user.avatar.thumb_url} /></ListItemIcon>
                <ListItemText primary={user.name} secondary={user.wcaId}/>
              </ListItem>
              <ListItem button key="signout">
                <ListItemText onClick={logout}>Sign out</ListItemText>
              </ListItem>
            </React.Fragment> :
              <ListItem onClick={login} button key="signout">
                <ListItemText>Sign in</ListItemText>
              </ListItem>
          }

          <Divider/>
          <ListItemLink to="/" key="home">
            <ListItemIcon><AppsIcon /></ListItemIcon>
            <ListItemText>Home</ListItemText>
          </ListItemLink>
        </List>
      </Drawer>
      <main className={classes.content}>
        <div className={classes.toolbarFix}/>
          {props.children}
      </main>
    </div>
  );
}

const mapStateToProps = (state) => ({
  roomName: state.room.name
});

export default connect(mapStateToProps)(Header)
