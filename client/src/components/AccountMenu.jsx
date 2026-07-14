import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import Avatar from '@material-ui/core/Avatar';
import Divider from '@material-ui/core/Divider';
import Drawer from '@material-ui/core/Drawer';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Typography from '@material-ui/core/Typography';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import PeopleIcon from '@material-ui/icons/People';
import PersonIcon from '@material-ui/icons/Person';
import { isFeatureEnabled } from '../lib/features';

const useStyles = makeStyles((theme) => ({
  desktopPaper: {
    minWidth: '17rem',
  },
  accountHeader: {
    alignItems: 'center',
    display: 'flex',
    padding: theme.spacing(2),
  },
  avatar: {
    height: theme.spacing(5),
    marginRight: theme.spacing(1.5),
    width: theme.spacing(5),
  },
  desktopItem: {
    minHeight: theme.spacing(6),
  },
  menuIcon: {
    minWidth: theme.spacing(5),
  },
  drawerPaper: {
    borderRadius: `${theme.spacing(2)}px ${theme.spacing(2)}px 0 0`,
  },
  drawerHandle: {
    backgroundColor: theme.palette.divider,
    borderRadius: theme.spacing(1),
    height: theme.spacing(0.5),
    margin: theme.spacing(1.25, 'auto', 0),
    width: theme.spacing(5),
  },
  drawerItem: {
    minHeight: theme.spacing(7),
    paddingLeft: theme.spacing(3),
    paddingRight: theme.spacing(3),
  },
}));

const accountName = (user) => user.displayName || user.name || user.username || 'Your account';

function AccountHeader({ user }) {
  const classes = useStyles();
  const name = accountName(user);

  return (
    <div className={classes.accountHeader}>
      <Avatar alt={name} className={classes.avatar} src={user.avatar && user.avatar.thumb_url}>
        {name.charAt(0).toUpperCase()}
      </Avatar>
      <div>
        <Typography variant="subtitle1">{name}</Typography>
        <Typography color="textSecondary" variant="body2">Account</Typography>
      </div>
    </div>
  );
}

AccountHeader.propTypes = {
  user: PropTypes.shape({
    avatar: PropTypes.shape({ thumb_url: PropTypes.string }),
    displayName: PropTypes.string,
    name: PropTypes.string,
    username: PropTypes.string,
  }).isRequired,
};

function AccountItems({ itemComponent: Item, itemClassName, onClose, onLogout }) {
  const classes = useStyles();

  return (
    <>
      {isFeatureEnabled('friends') && (
        <Item className={itemClassName} component={Link} onClick={onClose} to="/friends">
          <ListItemIcon className={classes.menuIcon}><PeopleIcon /></ListItemIcon>
          <ListItemText primary="Friends" secondary="Requests and connections" />
        </Item>
      )}
      <Item className={itemClassName} component={Link} onClick={onClose} to="/profile">
        <ListItemIcon className={classes.menuIcon}><PersonIcon /></ListItemIcon>
        <ListItemText primary="Profile" secondary="Your cuber identity" />
      </Item>
      <Divider />
      <Item className={itemClassName} onClick={onLogout}>
        <ListItemIcon className={classes.menuIcon}><ExitToAppIcon /></ListItemIcon>
        <ListItemText primary="Log out" />
      </Item>
    </>
  );
}

AccountItems.propTypes = {
  itemClassName: PropTypes.string.isRequired,
  itemComponent: PropTypes.elementType.isRequired,
  onClose: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
};

function AccountMenu({ anchorEl, onClose, onLogout, open, user }) {
  const classes = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        classes={{ paper: classes.drawerPaper }}
        onClose={onClose}
        open={open}
      >
        <div className={classes.drawerHandle} />
        <AccountHeader user={user} />
        <Divider />
        <List aria-label="Account navigation">
          <AccountItems
            itemClassName={classes.drawerItem}
            itemComponent={ListItem}
            onClose={onClose}
            onLogout={onLogout}
          />
        </List>
      </Drawer>
    );
  }

  return (
    <Menu
      anchorEl={anchorEl}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      id="account-menu"
      MenuListProps={{ 'aria-label': 'Account navigation' }}
      onClose={onClose}
      open={open}
      PaperProps={{ className: classes.desktopPaper }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <AccountHeader user={user} />
      <Divider />
      <AccountItems
        itemClassName={classes.desktopItem}
        itemComponent={MenuItem}
        onClose={onClose}
        onLogout={onLogout}
      />
    </Menu>
  );
}

AccountMenu.propTypes = {
  anchorEl: PropTypes.shape(),
  onClose: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
  user: PropTypes.shape({
    avatar: PropTypes.shape({ thumb_url: PropTypes.string }),
    displayName: PropTypes.string,
    name: PropTypes.string,
    username: PropTypes.string,
  }).isRequired,
};

AccountMenu.defaultProps = {
  anchorEl: null,
};

export default AccountMenu;
