/* eslint-env jest */

const { createReconnectGrace } = require('./reconnectGrace');

describe('reconnect grace', () => {
  const departure = {
    roomId: 'room-123',
    userId: 101,
    connectionId: 'socket-123',
    leaveReason: 'disconnect',
  };
  let hasActiveSockets;
  let finalizeDeparture;
  let listActiveUsers;
  let logger;

  const createManager = (graceMs = 30000, options = {}) => createReconnectGrace({
    graceMs,
    hasActiveSockets,
    finalizeDeparture,
    listActiveUsers,
    logger,
    ...options,
  });

  const flushPromises = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  };

  beforeEach(() => {
    jest.useFakeTimers();
    hasActiveSockets = jest.fn().mockResolvedValue(false);
    finalizeDeparture = jest.fn().mockResolvedValue(true);
    listActiveUsers = jest.fn().mockResolvedValue([]);
    logger = { error: jest.fn() };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the user in the room until the reconnect grace expires', async () => {
    let markFinalized;
    const finalized = new Promise((resolve) => {
      markFinalized = resolve;
    });
    finalizeDeparture.mockImplementationOnce(async (value) => {
      markFinalized(value);
      return true;
    });
    const manager = createManager();

    manager.schedule(departure);
    jest.advanceTimersByTime(29999);
    await Promise.resolve();

    expect(finalizeDeparture).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    await finalized;

    expect(hasActiveSockets).toHaveBeenCalledWith(101, 'room-123');
    expect(finalizeDeparture).toHaveBeenCalledWith(departure);
  });

  it('cancels pending cleanup when the user reconnects', async () => {
    const manager = createManager();

    manager.schedule(departure);
    manager.cancel(departure.roomId, departure.userId);
    jest.runAllTimers();
    await Promise.resolve();

    expect(hasActiveSockets).not.toHaveBeenCalled();
    expect(finalizeDeparture).not.toHaveBeenCalled();
  });

  it('lets a reconnect wait for cleanup already in progress', async () => {
    let finishFinalization;
    let markFinalizationStarted;
    const finalizationStarted = new Promise((resolve) => {
      markFinalizationStarted = resolve;
    });
    finalizeDeparture.mockImplementationOnce(() => new Promise((resolve) => {
      markFinalizationStarted();
      finishFinalization = resolve;
    }));
    const manager = createManager();

    manager.schedule(departure);
    jest.runAllTimers();
    await finalizationStarted;

    let reconnectReleased = false;
    const reconnect = manager.cancel(departure.roomId, departure.userId)
      .then((waited) => {
        reconnectReleased = true;
        return waited;
      });
    await Promise.resolve();

    expect(reconnectReleased).toBe(false);

    finishFinalization(true);
    await expect(reconnect).resolves.toBe(true);
  });

  it('finalizes an explicit departure without waiting for socket inactivity', async () => {
    const manager = createManager();

    await manager.finalize({ ...departure, leaveReason: 'explicit' });

    expect(hasActiveSockets).not.toHaveBeenCalled();
    expect(finalizeDeparture).toHaveBeenCalledWith({
      ...departure,
      leaveReason: 'explicit',
    });
  });

  it('does not remove a user who has another active socket', async () => {
    let markChecked;
    const checked = new Promise((resolve) => {
      markChecked = resolve;
    });
    hasActiveSockets.mockImplementationOnce(async () => {
      markChecked();
      return true;
    });
    const manager = createManager();

    manager.schedule(departure);
    jest.runAllTimers();
    await checked;

    expect(finalizeDeparture).not.toHaveBeenCalled();
  });

  it('reconciles users left active by a replaced socket process', async () => {
    const connected = { ...departure, userId: 202 };
    listActiveUsers.mockResolvedValue([departure, connected]);
    hasActiveSockets.mockImplementation(async (userId) => userId === 202);
    const manager = createManager();

    await manager.reconcile();

    expect(finalizeDeparture).toHaveBeenCalledTimes(1);
    expect(finalizeDeparture).toHaveBeenCalledWith(departure);
  });

  it('limits reconciliation concurrency across rooms', async () => {
    const departures = Array.from({ length: 5 }, (_, index) => ({
      ...departure,
      roomId: `room-${index}`,
      userId: 200 + index,
    }));
    let releaseFinalizations;
    const finalizationsBlocked = new Promise((resolve) => {
      releaseFinalizations = resolve;
    });
    let activeFinalizations = 0;
    let peakFinalizations = 0;
    listActiveUsers.mockResolvedValue(departures);
    finalizeDeparture.mockImplementation(async () => {
      activeFinalizations += 1;
      peakFinalizations = Math.max(peakFinalizations, activeFinalizations);
      await finalizationsBlocked;
      activeFinalizations -= 1;
      return true;
    });
    const manager = createManager(30000, { reconciliationConcurrency: 2 });

    const reconciliation = manager.reconcile();
    await flushPromises();

    expect(finalizeDeparture).toHaveBeenCalledTimes(2);

    releaseFinalizations();
    await reconciliation;

    expect(finalizeDeparture).toHaveBeenCalledTimes(5);
    expect(peakFinalizations).toBe(2);
  });

  it('retries a failed disconnect cleanup after checking socket activity again', async () => {
    finalizeDeparture
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce(true);
    const manager = createManager(30000, {
      maxFinalizationRetries: 1,
      finalizationRetryDelayMs: 5000,
    });

    manager.schedule(departure);
    jest.advanceTimersByTime(30000);
    await flushPromises();

    expect(finalizeDeparture).toHaveBeenCalledTimes(1);
    expect(hasActiveSockets).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(5000);
    await flushPromises();

    expect(finalizeDeparture).toHaveBeenCalledTimes(2);
    expect(hasActiveSockets).toHaveBeenCalledTimes(2);
  });

  it('does not retry departure after the user reconnects', async () => {
    hasActiveSockets
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    finalizeDeparture.mockRejectedValueOnce(new Error('database unavailable'));
    const manager = createManager(30000, {
      maxFinalizationRetries: 1,
      finalizationRetryDelayMs: 5000,
    });

    manager.schedule(departure);
    jest.advanceTimersByTime(30000);
    await flushPromises();
    jest.advanceTimersByTime(5000);
    await flushPromises();

    expect(hasActiveSockets).toHaveBeenCalledTimes(2);
    expect(finalizeDeparture).toHaveBeenCalledTimes(1);
  });

  it('serializes cleanup for users in the same room', async () => {
    let finishFirstDeparture;
    let markFirstStarted;
    const firstStarted = new Promise((resolve) => {
      markFirstStarted = resolve;
    });
    const secondDeparture = { ...departure, userId: 202 };
    listActiveUsers.mockResolvedValue([departure, secondDeparture]);
    finalizeDeparture
      .mockImplementationOnce(() => new Promise((resolve) => {
        markFirstStarted();
        finishFirstDeparture = resolve;
      }))
      .mockResolvedValueOnce(true);
    const manager = createManager();

    const reconciliation = manager.reconcile();
    await firstStarted;

    expect(finalizeDeparture).toHaveBeenCalledTimes(1);

    finishFirstDeparture(true);
    await reconciliation;

    expect(finalizeDeparture).toHaveBeenCalledTimes(2);
    expect(finalizeDeparture).toHaveBeenLastCalledWith(secondDeparture);
  });

  it('delays startup reconciliation by the same grace window', async () => {
    listActiveUsers.mockResolvedValue([departure]);
    const manager = createManager(45000);

    manager.startReconciliation();
    jest.advanceTimersByTime(44999);
    expect(listActiveUsers).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    await Promise.resolve();
    await Promise.resolve();

    expect(listActiveUsers).toHaveBeenCalledTimes(1);
  });

  it('repeats reconciliation after the configured interval', async () => {
    const manager = createManager(30000, { reconciliationIntervalMs: 60000 });

    manager.startReconciliation();
    jest.advanceTimersByTime(30000);
    await flushPromises();

    expect(listActiveUsers).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(59999);
    expect(listActiveUsers).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1);
    await flushPromises();

    expect(listActiveUsers).toHaveBeenCalledTimes(2);
  });
});
