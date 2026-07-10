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

  const createManager = (graceMs = 30000) => createReconnectGrace({
    graceMs,
    hasActiveSockets,
    finalizeDeparture,
    listActiveUsers,
    logger,
  });

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
});
