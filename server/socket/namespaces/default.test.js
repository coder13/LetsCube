/* eslint-env jest */

const Protocol = require('../../../client/src/lib/protocol.json');
const initDefault = require('./default');

jest.mock('../../logger', () => ({
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}));

describe('default socket namespace health check', () => {
  const setup = (report) => {
    const handlers = {};
    const socket = {
      id: 'socket-123',
      user: null,
      on: jest.fn((event, handler) => {
        handlers[event] = handler;
      }),
      emit: jest.fn(),
    };
    const namespace = {
      adapter: {
        allRooms: jest.fn().mockResolvedValue(new Set()),
      },
      emit: jest.fn(),
      on: jest.fn((event, handler) => {
        handlers[event] = handler;
      }),
      use: jest.fn(),
    };
    const io = { of: jest.fn().mockReturnValue(namespace) };
    const reportHealth = jest.fn().mockResolvedValue(report);

    initDefault(io, [], reportHealth);
    handlers.connection(socket);

    return { handlers, reportHealth, socket };
  };

  it('acknowledges a health check with the current report', async () => {
    const report = { status: 'ok', service: 'socket' };
    const { handlers, reportHealth } = setup(report);
    const acknowledgment = jest.fn();
    await handlers[Protocol.HEALTH_CHECK](acknowledgment);

    expect(reportHealth).toHaveBeenCalledTimes(1);
    expect(acknowledgment).toHaveBeenCalledWith(report);
  });

  it('emits health status when no acknowledgment is provided', async () => {
    const report = { status: 'ok', service: 'socket' };
    const { handlers, socket } = setup(report);

    await handlers[Protocol.HEALTH_CHECK]();

    expect(socket.emit).toHaveBeenCalledWith(Protocol.HEALTH_STATUS, report);
  });
});
