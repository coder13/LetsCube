import { lcFetch } from '../../lib/fetch';

export const NOTIFICATIONS_FETCHING = 'notifications/fetching';
export const NOTIFICATIONS_FETCHED = 'notifications/fetched';
export const NOTIFICATIONS_FAILED = 'notifications/failed';
export const NOTIFICATIONS_UNAVAILABLE = 'notifications/unavailable';
export const NOTIFICATION_ACTION_STARTED = 'notifications/action_started';
export const NOTIFICATION_ACTION_FINISHED = 'notifications/action_finished';
export const NOTIFICATION_ACTION_STALE = 'notifications/action_stale';

const requestError = async (response) => {
  let body = {};
  try {
    body = await response.json();
  } catch (err) {
    // Keep the server status as the useful error when a proxy sends no JSON body.
  }
  const error = new Error(body.message || 'Notification action failed');
  error.code = body.code;
  error.status = response.status;
  return error;
};

export const fetchNotifications = ({ append = false, cursor, limit = 10 } = {}) => (dispatch) => {
  dispatch({ type: NOTIFICATIONS_FETCHING, append });
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set('cursor', cursor);
  return lcFetch(`/api/notifications?${query.toString()}`)
    .then(async (response) => {
      if (response.status === 404) {
        dispatch({ type: NOTIFICATIONS_UNAVAILABLE });
        return null;
      }
      if (!response.ok) throw await requestError(response);
      const payload = await response.json();
      dispatch({ type: NOTIFICATIONS_FETCHED, append, payload });
      return payload;
    })
    .catch((error) => {
      dispatch({ type: NOTIFICATIONS_FAILED, error });
      return null;
    });
};

export const markNotificationRead = (notificationId) => (dispatch) => {
  dispatch({ notificationId, type: NOTIFICATION_ACTION_STARTED });
  return lcFetch(`/api/notifications/${notificationId}/read`, { method: 'POST' })
    .then(async (response) => {
      if (!response.ok) throw await requestError(response);
      dispatch({ notificationId, type: NOTIFICATION_ACTION_FINISHED });
      return response.json();
    })
    .catch((error) => {
      dispatch({ error, notificationId, type: NOTIFICATION_ACTION_FINISHED });
      throw error;
    });
};

export const markAllNotificationsRead = () => (dispatch) => {
  dispatch({ notificationId: 'all', type: NOTIFICATION_ACTION_STARTED });
  return lcFetch('/api/notifications/read-all', { method: 'POST' })
    .then(async (response) => {
      if (!response.ok) throw await requestError(response);
      dispatch({ notificationId: 'all', type: NOTIFICATION_ACTION_FINISHED });
      dispatch(fetchNotifications());
    })
    .catch((error) => {
      dispatch({ error, notificationId: 'all', type: NOTIFICATION_ACTION_FINISHED });
      throw error;
    });
};

const FRIEND_ACTIONS = {
  accept: 'accept',
  decline: 'decline',
};

const isStaleFriendAction = (error) => error.status === 409 && [
  'invalid_relationship_transition',
  'relationship_unavailable',
].includes(error.code);

export const runFriendNotificationAction = (notification, action) => (dispatch) => {
  const suffix = action === FRIEND_ACTIONS.accept ? 'accept' : 'decline';
  if (notification.type !== 'friend_request' || !notification.actor || !FRIEND_ACTIONS[action]) {
    return Promise.reject(new Error('Notification action is no longer available'));
  }
  dispatch({ notificationId: notification.id, type: NOTIFICATION_ACTION_STARTED });
  return lcFetch(`/api/friends/requests/${notification.actor.id}/${suffix}`, { method: 'POST' })
    .then(async (response) => {
      if (!response.ok) throw await requestError(response);
      await dispatch(markNotificationRead(notification.id));
      dispatch({ notificationId: notification.id, type: NOTIFICATION_ACTION_FINISHED });
      dispatch(fetchNotifications());
    })
    .catch((error) => {
      if (isStaleFriendAction(error)) {
        return dispatch(markNotificationRead(notification.id))
          .catch(() => null)
          .then(() => {
            dispatch({ notificationId: notification.id, type: NOTIFICATION_ACTION_STALE });
            dispatch(fetchNotifications());
          });
      }
      dispatch({ error, notificationId: notification.id, type: NOTIFICATION_ACTION_FINISHED });
      throw error;
    });
};

export { FRIEND_ACTIONS };
