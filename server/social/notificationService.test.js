/** @jest-environment node */
/* eslint-env jest */

const mongoose = require('mongoose');
const { createNotificationService } = require('./notificationService');

const clone = (value) => JSON.parse(JSON.stringify(value));

const createModels = () => {
  const notifications = [];
  const users = new Map([
    [1, {
      id: 1, name: 'One', username: 'one', preferRealName: false,
    }],
    [2, {
      id: 2, name: 'Two', username: 'two', preferRealName: false,
    }],
  ]);
  const notificationModel = {
    countDocuments: jest.fn(async (filter) => notifications.filter((entry) => (
      entry.recipientId === filter.recipientId && !entry.readAt
    )).length),
    create: jest.fn(async (document) => {
      if (notifications.some((entry) => entry.dedupeKey === document.dedupeKey)) {
        const error = new Error('duplicate notification');
        error.code = 11000;
        throw error;
      }
      const notification = {
        ...document,
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date('2026-07-12T12:00:00.000Z'),
        updatedAt: new Date('2026-07-12T12:00:00.000Z'),
      };
      notifications.push(notification);
      return clone(notification);
    }),
    find: jest.fn((filter) => ({
      limit: (limit) => ({
        lean: async () => notifications.filter((entry) => entry.recipientId === filter.recipientId
          && entry.expiresAt > filter.expiresAt.$gt).sort((first, second) => (
          second.createdAt - first.createdAt
            || second._id.toString().localeCompare(first._id.toString())
        )).slice(0, limit).map(clone),
      }),
      sort: () => ({
        limit: (limit) => ({
          lean: async () => notifications.filter((entry) => entry.recipientId === filter.recipientId
            && entry.expiresAt > filter.expiresAt.$gt).sort((first, second) => (
            second.createdAt - first.createdAt
              || second._id.toString().localeCompare(first._id.toString())
          )).slice(0, limit).map(clone),
        }),
      }),
    })),
    findOneAndUpdate: jest.fn(async (filter, update) => {
      const notification = notifications.find((entry) => (
        entry._id.toString() === filter._id.toString() && entry.recipientId === filter.recipientId
      ));
      if (!notification) return null;
      notification.readAt = update.$set.readAt;
      notification.updatedAt = update.$set.readAt;
      return clone(notification);
    }),
    updateMany: jest.fn(async (filter, update) => {
      const matching = notifications.filter(
        (entry) => entry.recipientId === filter.recipientId && !entry.readAt,
      );
      matching.forEach((entry) => { entry.readAt = update.$set.readAt; });
      return { modifiedCount: matching.length };
    }),
  };
  const userModel = {
    find: jest.fn(async ({ id }) => id.$in.map((userId) => users.get(userId)).filter(Boolean)),
  };
  return { notificationModel, notifications, userModel };
};

describe('notification service', () => {
  const now = () => new Date('2026-07-12T12:00:00.000Z');
  let events;
  let mirror;
  let models;
  let service;

  beforeEach(() => {
    models = createModels();
    events = { publishCreated: jest.fn(), publishUpdated: jest.fn() };
    mirror = jest.fn();
    service = createNotificationService({
      ...models, eventPublisher: events, mirror, notificationLogger: { error: jest.fn() }, now,
    });
  });

  const request = () => service.createFriendRequest({
    actor: { id: 1 }, recipient: { id: 2 }, relationship: { _id: 'relationship-1', revision: 0 },
  });

  it('deduplicates a notification source and sends only typed safe socket data', async () => {
    await expect(request()).resolves.toMatchObject({ created: true });
    await expect(request()).resolves.toEqual({ created: false, notification: null });

    expect(models.notifications).toHaveLength(1);
    expect(events.publishCreated).toHaveBeenCalledWith(expect.objectContaining({
      recipientId: 2,
      notification: expect.objectContaining({ actorId: 1, type: 'friend_request' }),
    }));
    const payload = events.publishCreated.mock.calls[0][0].notification;
    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('action');
    expect(payload).not.toHaveProperty('url');
  });

  it('lists only the recipient records with cursor metadata and public actors', async () => {
    await request();
    await service.createFriendRequestAccepted({
      actor: { id: 2 }, recipient: { id: 1 }, relationship: { _id: 'relationship-1', revision: 1 },
    });

    const response = await service.list({ id: 2 }, { limit: 1 });

    expect(response.notifications).toHaveLength(1);
    expect(response.notifications[0]).toMatchObject({ actor: { id: 1 }, type: 'friend_request' });
    expect(response.notifications[0].actor).not.toHaveProperty('email');
    expect(response.nextCursor).toBeNull();
    expect(response.unreadCount).toBe(1);
  });

  it('cannot mark another recipient notification read and safely marks all own notifications', async () => {
    await request();
    const id = models.notifications[0]._id.toString();

    await expect(service.markRead({ id: 1 }, id)).rejects.toMatchObject({
      code: 'notification_not_found', statusCode: 404,
    });
    await expect(service.markRead({ id: 2 }, id)).resolves.toMatchObject({
      notification: { id, readAt: now().toISOString() },
    });
    await expect(service.markAllRead({ id: 2 })).resolves.toEqual({ updated: 0 });
    expect(events.publishUpdated).toHaveBeenCalled();
  });

  it('does not use PostgreSQL availability to determine notification success', async () => {
    mirror.mockRejectedValue(new Error('PostgreSQL unavailable'));
    await expect(request()).resolves.toMatchObject({ created: true });
  });
});
