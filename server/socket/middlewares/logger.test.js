/* eslint-env jest */

const logger = require('../../logger');
const loggerMiddleware = require('./logger');

jest.mock('../../logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
}));

describe('socket logger middleware', () => {
  it('redacts passwords without changing the event payload', () => {
    const handlers = {};
    const socket = {
      id: 'socket-one',
      userId: 101,
      roomId: null,
      onAny: jest.fn((handler) => {
        handlers.any = handler;
      }),
      on: jest.fn((event, handler) => {
        handlers[event] = handler;
      }),
    };
    const next = jest.fn();
    const payload = {
      id: 'room-one',
      password: 'room-secret',
      nested: { newPassword: 'another-secret' },
    };

    loggerMiddleware(socket, next);
    handlers.any('join_room', payload);

    expect(logger.info).toHaveBeenCalledWith('join_room', expect.objectContaining({
      data: {
        id: 'room-one',
        password: '[REDACTED]',
        nested: { newPassword: '[REDACTED]' },
      },
    }));
    expect(payload.password).toBe('room-secret');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
