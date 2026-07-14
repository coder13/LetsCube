import reducer from './reducer';
import {
  NOTIFICATION_ACTION_FINISHED,
  NOTIFICATION_ACTION_STARTED,
  NOTIFICATION_ACTION_STALE,
  NOTIFICATIONS_FETCHED,
  NOTIFICATIONS_UNAVAILABLE,
} from './actions';

const notification = {
  actor: { id: 2, username: 'two' },
  id: 'notification-1',
  readAt: null,
  source: { id: 'relationship-1', type: 'friend_relationship' },
  type: 'friend_request',
};

describe('notification reducer', () => {
  it('keeps unread counts and the recent page from the recipient API', () => {
    const state = reducer(undefined, {
      append: false,
      payload: { nextCursor: 'cursor-2', notifications: [notification], unreadCount: 1 },
      type: NOTIFICATIONS_FETCHED,
    });

    expect(state).toMatchObject({
      enabled: true,
      nextCursor: 'cursor-2',
      notifications: [notification],
      unreadCount: 1,
    });
  });

  it('retains an action error so stale friend requests can be retried or reconciled', () => {
    const pending = reducer(undefined, {
      notificationId: notification.id,
      type: NOTIFICATION_ACTION_STARTED,
    });
    const error = new Error('The request is no longer pending');
    const state = reducer(pending, {
      error,
      notificationId: notification.id,
      type: NOTIFICATION_ACTION_FINISHED,
    });

    expect(state.actionPending[notification.id]).toBe(false);
    expect(state.actionErrors[notification.id]).toBe(error);
  });

  it('hides the inbox after the default-off server gate responds unavailable', () => {
    expect(reducer(undefined, { type: NOTIFICATIONS_UNAVAILABLE })).toMatchObject({
      enabled: false,
      notifications: [],
      unreadCount: 0,
    });
  });

  it('makes a stale action non-actionable after server revalidation', () => {
    const state = reducer(undefined, {
      notificationId: notification.id,
      type: NOTIFICATION_ACTION_STALE,
    });

    expect(state.actionStale[notification.id]).toBe(true);
  });
});
