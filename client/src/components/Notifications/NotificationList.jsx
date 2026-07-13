import React from 'react';
import PropTypes from 'prop-types';
import Button from '@material-ui/core/Button';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Typography from '@material-ui/core/Typography';
import notificationPresentation from './registry';

export default function NotificationList({
  actionErrors, actionPending, actionStale, notifications, onAction,
}) {
  if (notifications.length === 0) {
    return <Typography color="textSecondary">You have no notifications.</Typography>;
  }
  return (
    <List aria-label="Notifications">
      {notifications.map((notification) => {
        const presentation = notificationPresentation(notification);
        const pending = !!actionPending[notification.id];
        const stale = !!actionStale[notification.id];
        return (
          <ListItem alignItems="flex-start" divider key={notification.id}>
            <ListItemText
              primary={presentation.text}
              secondary={notification.readAt ? 'Read' : 'Unread'}
            />
            <div>
              {!stale && presentation.actions.map((action) => (
                <Button
                  aria-label={`${action} friend request`}
                  color={action === 'accept' ? 'primary' : 'default'}
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
