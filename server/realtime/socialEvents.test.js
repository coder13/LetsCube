/** @jest-environment node */
/* eslint-env jest */

const Protocol = require('../../client/src/lib/protocol.json');
const {
  SOCIAL_EVENT_CHANNEL,
  createSocialEventPublisher,
  parseSocialEvent,
  registerSocialEventSubscriber,
} = require('./socialEvents');

describe('social realtime invalidations', () => {
  it('publishes a versioned event with unique valid recipients', async () => {
    const client = { publish: jest.fn().mockResolvedValue(1) };
    const publish = createSocialEventPublisher({
      client,
      now: () => new Date('2026-07-12T12:00:00.000Z'),
    });

    await expect(publish({ userIds: [2, 1, 2, 'invalid'] })).resolves.toBe(true);
    expect(client.publish).toHaveBeenCalledTimes(1);
    const [channel, message] = client.publish.mock.calls[0];
    expect(channel).toBe(SOCIAL_EVENT_CHANNEL);
    expect(JSON.parse(message)).toEqual({
      occurredAt: '2026-07-12T12:00:00.000Z',
      schemaVersion: 1,
      type: Protocol.FRIEND_STATE_INVALIDATED,
      userIds: [2, 1],
    });
  });

  it('relays only an opaque payload to each authenticated user room', () => {
    const handlers = {};
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    const namespace = { to };
    const io = { of: jest.fn(() => namespace) };
    const client = {
      on: jest.fn((event, handler) => {
        handlers[event] = handler;
      }),
      subscribe: jest.fn().mockResolvedValue(1),
    };

    registerSocialEventSubscriber(io, client);
    handlers.message(SOCIAL_EVENT_CHANNEL, JSON.stringify({
      occurredAt: '2026-07-12T12:00:00.000Z',
      schemaVersion: 1,
      type: Protocol.FRIEND_STATE_INVALIDATED,
      userIds: [1, 2],
    }));

    expect(to.mock.calls).toEqual([['user/1'], ['user/2']]);
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenCalledWith(Protocol.FRIEND_STATE_INVALIDATED, {
      occurredAt: '2026-07-12T12:00:00.000Z',
      schemaVersion: 1,
    });
    expect(emit.mock.calls[0][1]).not.toHaveProperty('userIds');
  });

  it('relays typed notification events only to the recipient user room', () => {
    const handlers = {};
    const emit = jest.fn();
    const io = { of: jest.fn(() => ({ to: jest.fn(() => ({ emit })) })) };
    const client = {
      on: jest.fn((event, handler) => { handlers[event] = handler; }),
      subscribe: jest.fn().mockResolvedValue(1),
    };

    registerSocialEventSubscriber(io, client);
    handlers.message(SOCIAL_EVENT_CHANNEL, JSON.stringify({
      notification: {
        actorId: 1,
        createdAt: '2026-07-12T12:00:00.000Z',
        expiresAt: '2026-08-11T12:00:00.000Z',
        id: '507f1f77bcf86cd799439011',
        readAt: null,
        source: { id: 'relationship-1', type: 'friend_relationship' },
        type: 'friend_request',
      },
      schemaVersion: 1,
      type: Protocol.NOTIFICATION_CREATED,
      userIds: [2],
    }));

    expect(emit).toHaveBeenCalledWith(Protocol.NOTIFICATION_CREATED, expect.objectContaining({
      notification: expect.objectContaining({ type: 'friend_request' }),
    }));
    expect(emit.mock.calls[0][1].notification).not.toHaveProperty('email');
  });

  it('ignores malformed or unknown events', () => {
    expect(parseSocialEvent('not-json')).toBeNull();
    expect(parseSocialEvent(JSON.stringify({
      schemaVersion: 2,
      type: Protocol.FRIEND_STATE_INVALIDATED,
      userIds: [1],
    }))).toBeNull();
    expect(parseSocialEvent(JSON.stringify({
      schemaVersion: 1,
      type: 'relationship_details',
      userIds: [1],
    }))).toBeNull();
  });

  it('does not fail durable actions when Redis is unavailable', async () => {
    const error = new Error('redis unavailable');
    const eventLogger = { error: jest.fn() };
    const publish = createSocialEventPublisher({
      client: { publish: jest.fn().mockRejectedValue(error) },
      eventLogger,
    });

    await expect(publish({ userIds: [1, 2] })).resolves.toBe(false);
    expect(eventLogger.error).toHaveBeenCalledWith(error);
  });
});
