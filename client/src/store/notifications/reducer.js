import {
  NOTIFICATION_ACTION_FINISHED,
  NOTIFICATION_ACTION_STARTED,
  NOTIFICATION_ACTION_STALE,
  NOTIFICATIONS_FAILED,
  NOTIFICATIONS_FETCHED,
  NOTIFICATIONS_FETCHING,
  NOTIFICATIONS_UNAVAILABLE,
} from './actions';

const INITIAL_STATE = {
  actionErrors: {},
  actionPending: {},
  actionStale: {},
  enabled: null,
  error: null,
  fetching: false,
  nextCursor: null,
  notifications: [],
  unreadCount: 0,
};

const byId = (notifications) => notifications.reduce((result, notification) => ({
  ...result,
  [notification.id]: notification,
}), {});

export default function notificationsReducer(state = INITIAL_STATE, action) {
  switch (action.type) {
    case NOTIFICATIONS_FETCHING:
      return { ...state, error: null, fetching: true };
    case NOTIFICATIONS_FETCHED: {
      const merged = action.append
        ? Object.values({ ...byId(state.notifications), ...byId(action.payload.notifications) })
        : action.payload.notifications;
      return {
        ...state,
        enabled: true,
        error: null,
        fetching: false,
        nextCursor: action.payload.nextCursor,
        notifications: merged,
        unreadCount: action.payload.unreadCount,
      };
    }
    case NOTIFICATIONS_UNAVAILABLE:
      return { ...INITIAL_STATE, enabled: false };
    case NOTIFICATIONS_FAILED:
      return { ...state, error: action.error, fetching: false };
    case NOTIFICATION_ACTION_STARTED:
      return {
        ...state,
        actionErrors: { ...state.actionErrors, [action.notificationId]: null },
        actionPending: { ...state.actionPending, [action.notificationId]: true },
        actionStale: { ...state.actionStale, [action.notificationId]: false },
      };
    case NOTIFICATION_ACTION_STALE:
      return {
        ...state,
        actionPending: { ...state.actionPending, [action.notificationId]: false },
        actionStale: { ...state.actionStale, [action.notificationId]: true },
      };
    case NOTIFICATION_ACTION_FINISHED:
      return {
        ...state,
        actionErrors: action.error
          ? { ...state.actionErrors, [action.notificationId]: action.error }
          : state.actionErrors,
        actionPending: { ...state.actionPending, [action.notificationId]: false },
      };
    default:
      return state;
  }
}
