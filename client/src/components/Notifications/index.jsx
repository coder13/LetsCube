import React, { useEffect } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Container from '@material-ui/core/Container';
import Typography from '@material-ui/core/Typography';
import {
  fetchNotifications,
  markAllNotificationsRead,
  runFriendNotificationAction,
} from '../../store/notifications/actions';
import NotificationList from './NotificationList';

export function NotificationsPage({
  notifications, fetchPage, markAllRead, runAction,
}) {
  useEffect(() => { fetchPage(); }, [fetchPage]);
  if (notifications.enabled === false) {
    return <Container><Typography variant="h5">Notifications are unavailable.</Typography></Container>;
  }
  return (
    <Container maxWidth="sm" style={{ paddingTop: '1rem', width: '100%' }}>
      <Typography variant="h4">Notifications</Typography>
      {notifications.fetching && notifications.notifications.length === 0 && <CircularProgress />}
      {notifications.error && <Typography color="error">{notifications.error.message}</Typography>}
      <Button
        disabled={!notifications.unreadCount || notifications.actionPending.all}
        onClick={markAllRead}
      >
        Mark all as read
      </Button>
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
