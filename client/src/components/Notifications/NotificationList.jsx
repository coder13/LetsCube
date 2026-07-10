import React from 'react';
import PropTypes from 'prop-types';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { makeStyles } from '@mui/styles';
import notificationPresentation from './registry';

const useStyles = makeStyles((theme) => ({
  list: {
    marginTop: theme.spacing(1),
  },
  notification: {
    alignItems: 'center',
    borderLeft: '3px solid transparent',
    paddingBottom: theme.spacing(1.5),
    paddingTop: theme.spacing(1.5),
  },
  unread: {
    backgroundColor: theme.palette.action.hover,
    borderLeftColor: theme.palette.primary.main,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    marginLeft: theme.spacing(1),
    minWidth: '5rem',
  },
  status: {
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
    marginTop: theme.spacing(0.5),
  },
}));

export default function NotificationList({
  actionErrors, actionPending, actionStale, notifications, onAction,
}) {
  const classes = useStyles();
  if (notifications.length === 0) {
    return <Typography color="textSecondary">You have no notifications.</Typography>;
  }
  return (
    <List aria-label="Notifications" className={classes.list}>
      {notifications.map((notification) => {
        const presentation = notificationPresentation(notification);
        const pending = !!actionPending[notification.id];
        const stale = !!actionStale[notification.id];
        return (
          <ListItem
            alignItems="flex-start"
            className={`${classes.notification} ${notification.readAt ? '' : classes.unread}`}
            divider
            key={notification.id}
          >
            <ListItemText
              primary={presentation.text}
              secondary={<span className={classes.status}>{notification.readAt ? 'Viewed' : 'New'}</span>}
            />
            <div className={classes.actions}>
              {!stale && presentation.actions.map((action) => (
                <Button
                  aria-label={`${action} notification`}
                  color={action === 'accept' || action === 'join race' ? 'primary' : 'default'}
                  disabled={pending}
                  key={action}
                  onClick={() => onAction(notification, action)}
                  size="small"
                >
                  {action}
                </Button>
              ))}
              {actionErrors[notification.id] && (
                <Typography color="error" variant="caption">
                  {actionErrors[notification.id].message}
                </Typography>
              )}
              {stale && <Typography color="textSecondary" variant="caption">This request is no longer active.</Typography>}
            </div>
          </ListItem>
        );
      })}
    </List>
  );
}

NotificationList.propTypes = {
  actionErrors: PropTypes.shape(),
  actionPending: PropTypes.shape(),
  actionStale: PropTypes.shape(),
  notifications: PropTypes.arrayOf(PropTypes.shape({
    actor: PropTypes.shape({ id: PropTypes.number }),
    id: PropTypes.string.isRequired,
    readAt: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    type: PropTypes.string.isRequired,
  })).isRequired,
  onAction: PropTypes.func.isRequired,
};

NotificationList.defaultProps = {
  actionErrors: {},
  actionPending: {},
  actionStale: {},
};
