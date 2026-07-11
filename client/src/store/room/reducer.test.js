import { joinRoom, newResult } from './actions';
import roomReducer from './reducer';

const initialState = () => ({
  ...roomReducer(undefined, { type: '@@INIT' }),
  attempts: [{
    _id: 'old-attempt',
    id: 0,
    results: {},
  }, {
    _id: 'latest-attempt',
    id: 1,
    results: {},
  }],
  waitingFor: { 42: true },
});

describe('room result updates', () => {
  it('does not clear current waiting state for a delayed historical result', () => {
    const state = roomReducer(initialState(), newResult({
      id: 0,
      userId: 42,
      result: { time: 1234, penalties: {} },
    }));

    expect(state.attempts[0].results[42]).toEqual({ time: 1234, penalties: {} });
    expect(state.waitingFor[42]).toBe(true);
  });

  it('clears waiting state when the result belongs to the latest attempt', () => {
    const state = roomReducer(initialState(), newResult({
      id: 1,
      userId: 42,
      result: { time: 2345, penalties: {} },
    }));

    expect(state.attempts[1].results[42]).toEqual({ time: 2345, penalties: {} });
    expect(state.waitingFor[42]).toBe(false);
  });
});

describe('room joins', () => {
  it('shows the loading state for an initial room join', () => {
    const state = roomReducer(undefined, joinRoom({ id: 'room-1' }));

    expect(state.fetching).toBe(true);
  });

  it('keeps an active room mounted during a reconnect join', () => {
    const loadedRoom = {
      ...roomReducer(undefined, { type: '@@INIT' }),
      fetching: false,
      _id: 'room-1',
      accessCode: 'access-code',
      attempts: [{ _id: 'attempt-1', id: 0 }],
    };

    const state = roomReducer(loadedRoom, joinRoom({
      id: 'room-1',
      reconnecting: true,
    }));

    expect(state.fetching).toBe(false);
    expect(state.attempts).toBe(loadedRoom.attempts);
  });
});
