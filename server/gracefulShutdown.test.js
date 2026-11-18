/* eslint-env jest */

const { registerGracefulShutdown } = require('./gracefulShutdown');

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('graceful shutdown', () => {
  let close;
  let logger;
  let processRef;
  let signals;

  beforeEach(() => {
    jest.useFakeTimers();
    close = jest.fn().mockResolvedValue(undefined);
    logger = { info: jest.fn(), error: jest.fn() };
    signals = {};
    processRef = {
      once: jest.fn((signal, handler) => { signals[signal] = handler; }),
      exit: jest.fn(),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('closes once and exits successfully', async () => {
    const shutDown = registerGracefulShutdown({
      name: 'TEST', close, logger, processRef,
    });

    signals.SIGTERM();
    signals.SIGINT();
    await shutDown('SIGTERM');

    expect(close).toHaveBeenCalledTimes(1);
    expect(processRef.exit).toHaveBeenCalledWith(0);
  });

  it('exits with a failure when cleanup fails', async () => {
    close.mockRejectedValue(new Error('cleanup failed'));
    const shutDown = registerGracefulShutdown({
      name: 'TEST', close, logger, processRef,
    });

    await expect(shutDown('SIGTERM')).resolves.toBe(false);

    expect(logger.error).toHaveBeenCalledWith(expect.any(Error));
    expect(processRef.exit).toHaveBeenCalledWith(1);
  });

  it('forces an exit when cleanup exceeds the deadline', async () => {
    close.mockReturnValue(new Promise(() => {}));
    const shutDown = registerGracefulShutdown({
      name: 'TEST', close, logger, processRef, timeoutMs: 1000,
    });

    shutDown('SIGTERM');
    await flushPromises();
    jest.advanceTimersByTime(1000);

    expect(processRef.exit).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith('[TEST] Graceful shutdown timed out');
  });
});
