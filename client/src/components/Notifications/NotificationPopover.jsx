import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import Avatar from '@material-ui/core/Avatar';
import Button from '@material-ui/core/Button';
import Divider from '@material-ui/core/Divider';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import ListItemText from '@material-ui/core/ListItemText';
import Popover from '@material-ui/core/Popover';
import Typography from '@material-ui/core/Typography';
import NotificationsNoneIcon from '@material-ui/icons/NotificationsNone';
import notificationPresentation from './registry';

const useStyles = makeStyles((theme) => ({
  panel: {
    width: '23rem',
    maxWidth: 'calc(100vw - 2rem)',
  },
  header: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    padding: theme.spacing(1.5, 2),
  },
  previewList: {
    maxHeight: '22rem',
    overflowY: 'auto',
    padding: 0,
  },
  preview: {
    alignItems: 'center',
    borderLeft: '3px solid transparent',
    minHeight: '4.5rem',
    paddingLeft: theme.spacing(1.5),
  },
  unread: {
    backgroundColor: theme.palette.action.hover,
    borderLeftColor: theme.palette.primary.main,
  },
  avatar: {
    backgroundColor: theme.palette.primary.light,
  },
  unreadIndicator: {
    backgroundColor: theme.palette.primary.main,
    borderRadius: '50%',
    height: theme.spacing(1),
    marginLeft: theme.spacing(1),
    width: theme.spacing(1),
  },
  emptyState: {
    alignItems: 'center',
    color: theme.palette.text.secondary,
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(4, 2),
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '2rem',
    marginBottom: theme.spacing(1),
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: theme.spacing(0.5, 1),
  },
}));

const actorName = (notification) => {
  const actor = notification.actor || {};
  return actor.displayName || actor.username || 'A';
};

export function NotificationPopover({ anchorEl, notifications, onClose, unreadCount }) {
  const classes = useStyles();
  const open = Boolean(anchorEl);

  return (
    <Popover
      anchorEl={anchorEl}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      id={open ? 'notification-panel' : undefined}
      onClose={onClose}
      open={open}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <div className={classes.panel}>
        <div className={classes.header}>
          <div>
            <Typography variant="h6">Notifications</Typography>
            <Typography color="textSecondary" variant="caption">
              {unreadCount ? `${unreadCount} unread` : 'You’re all caught up'}
            </Typography>
          </div>
          {unreadCount > 0 && <Typography color="primary" variant="caption">New activity</Typography>}
        </div>
        <Divider />
        {notifications.length === 0 ? (
          <div className={classes.emptyState}>
            <NotificationsNoneIcon className={classes.emptyIcon} />
            <Typography variant="body2">You’re all caught up.</Typography>
            <Typography variant="caption">New activity will appear here.</Typography>
          </div>
        ) : (
          <List aria-label="Recent notifications" className={classes.previewList}>
            {notifications.slice(0, 5).map((notification) => {
              const name = actorName(notification);
              const unread = !notification.readAt;
              return (
                <ListItem
                  button
                  className={`${classes.preview} ${unread ? classes.unread : ''}`}
                  component={Link}
                  key={notification.id}
                  onClick={onClose}
                  to="/notifications"
                >
                  <ListItemAvatar>
                    <Avatar
                      alt={name}
                      className={classes.avatar}
                      src={notification.actor && notification.actor.avatar && notification.actor.avatar.thumb_url}
                    >
                      {name.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={notificationPresentation(notification).text}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondary={unread ? 'New' : 'Viewed'}
                  />
                  {unread && <span aria-label="Unread notification" className={classes.unreadIndicator} />}
                </ListItem>
              );
            })}
          </List>
        )}
        <Divider />
        <div className={classes.footer}>
          <Button component={Link} onClick={onClose} size="small" to="/notifications">
            View all notifications
          </Button>
        </div>
      </div>
    </Popover>
  );
}

NotificationPopover.propTypes = {
  anchorEl: PropTypes.shape(),
  notifications: PropTypes.arrayOf(PropTypes.shape({
    actor: PropTypes.shape({
      avatar: PropTypes.shape({ thumb_url: PropTypes.string }),
      displayName: PropTypes.string,
      username: PropTypes.string,
    }),
    id: PropTypes.string.isRequired,
    readAt: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    type: PropTypes.string.isRequired,
  })),
  onClose: PropTypes.func.isRequired,
  unreadCount: PropTypes.number,
};

NotificationPopover.defaultProps = {
  anchorEl: null,
  notifications: [],
  unreadCount: 0,
};

export default NotificationPopover;
