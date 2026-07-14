
const {
  createSafeSocketHandler,
  optionalAcknowledgment,
} = require('./socketHandler');

describe('createSafeSocketHandler', () => {
  const flushPromises = () => new Promise(setImmediate);

  it('reports rejected handlers without leaving an unhandled rejection', async () => {
    const listeners = {};
    const socket = {
      connected: true,
      emit: jest.fn(),
      on: jest.fn((event, handler) => {
        listeners[event] = handler;
      }),
    };
    const logger = { error: jest.fn() };
    const on = createSafeSocketHandler(socket, logger, 'errorrr');
    const failure = new Error('bad payload');

    on('join_room', async () => {
      throw failure;
    });
    listeners.join_room();
    await flushPromises();

    expect(logger.error).toHaveBeenCalledWith(failure);
    expect(socket.emit).toHaveBeenCalledWith('errorrr', {
      statusCode: 500,
      event: 'join_room',
      message: 'Socket event failed',
    });
  });

  it('uses an acknowledgement callback when one was provided', async () => {
    const listeners = {};
    const socket = {
      connected: true,
      emit: jest.fn(),
      on: jest.fn((event, handler) => {
        listeners[event] = handler;
      }),
    };
    const logger = { error: jest.fn() };
    const acknowledgment = jest.fn();
    const on = createSafeSocketHandler(socket, logger, 'errorrr');

    on('delete_room', () => {
      throw new Error('missing room');
    });
    listeners.delete_room('room-123', acknowledgment);
    await flushPromises();

    expect(acknowledgment).toHaveBeenCalledWith({
      statusCode: 500,
      event: 'delete_room',
      message: 'Socket event failed',
    });
    expect(socket.emit).not.toHaveBeenCalled();
  });
});

describe('optionalAcknowledgment', () => {
  it('preserves callbacks and substitutes a no-op for missing callbacks', () => {
    const acknowledgment = jest.fn();

    expect(optionalAcknowledgment(acknowledgment)).toBe(acknowledgment);
    expect(() => optionalAcknowledgment(undefined)({ statusCode: 400 })).not.toThrow();
  });
});
