import React, { useEffect } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { makeStyles } from '@mui/styles';
import {
  fetchNotifications,
  markAllNotificationsRead,
  runFriendNotificationAction,
} from '../../store/notifications/actions';
import NotificationList from './NotificationList';

const useStyles = makeStyles((theme) => ({
  root: {
    paddingTop: theme.spacing(3),
  },
  heading: {
    alignItems: 'flex-start',
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1),
  },
  count: {
    marginTop: theme.spacing(1),
  },
}));

export function NotificationsPage({
  notifications, fetchPage, markAllRead, runAction,
}) {
  const classes = useStyles();
  useEffect(() => { fetchPage(); }, [fetchPage]);
  if (notifications.enabled === false) {
    return <Container><Typography variant="h5">Notifications are unavailable.</Typography></Container>;
  }
  return (
    <Container className={classes.root} maxWidth="sm" style={{ width: '100%' }}>
      <div className={classes.heading}>
        <div>
          <Typography variant="h4">Notifications</Typography>
          <Typography className={classes.count} color="textSecondary" variant="body2">
            {notifications.unreadCount ? `${notifications.unreadCount} unread` : 'You’re all caught up'}
          </Typography>
        </div>
        <Button
          disabled={!notifications.unreadCount || notifications.actionPending.all}
          onClick={markAllRead}
        >
          Mark all as read
        </Button>
      </div>
      {notifications.fetching && notifications.notifications.length === 0 && <CircularProgress />}
      {notifications.error && <Typography color="error">{notifications.error.message}</Typography>}
      <NotificationList
        actionErrors={notifications.actionErrors}
        actionPending={notifications.actionPending}
        actionStale={notifications.actionStale}
        notifications={notifications.notifications}
        onAction={runAction}
      />
      {notifications.nextCursor && (
        <Button disabled={notifications.fetching} onClick={() => fetchPage({ append: true, cursor: notifications.nextCursor, limit: 20 })}>
          Load more
        </Button>
      )}
    </Container>
  );
}

NotificationsPage.propTypes = {
  fetchPage: PropTypes.func.isRequired,
  markAllRead: PropTypes.func.isRequired,
  notifications: PropTypes.shape().isRequired,
  runAction: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => ({ notifications: state.notifications });
const mapDispatchToProps = (dispatch) => ({
  fetchPage: (options) => dispatch(fetchNotifications({ limit: 20, ...options })),
  markAllRead: () => dispatch(markAllNotificationsRead()),
  runAction: (notification, action) => dispatch(runFriendNotificationAction(notification, action)),
});

export default connect(mapStateToProps, mapDispatchToProps)(NotificationsPage);
