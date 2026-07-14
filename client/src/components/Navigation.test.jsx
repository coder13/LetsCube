import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  GlobalPendingResultAlert,
  shouldShowGlobalPendingResult,
} from './Navigation';
import {
  createPendingResult,
  markPendingResultAttempted,
} from '../store/room/resultOutbox';

const pendingResult = createPendingResult({
  userId: 42,
  roomId: 'original-room',
  attemptId: 7,
  attemptKey: 'attempt-seven',
  result: { time: 1234, penalties: {} },
}, {
  createId: () => 'submission-one',
  now: () => 1000,
});

describe('global pending result alert', () => {
  it('is hidden when a joined normal room can render the room-level controls', () => {
    expect(shouldShowGlobalPendingResult({
      accessCode: 'ABC123',
      fetching: false,
      type: 'normal',
    }, pendingResult)).toBe(false);

    expect(shouldShowGlobalPendingResult({
      accessCode: 'ABC123',
      fetching: true,
      type: 'normal',
    }, pendingResult)).toBe(true);
  });

  it('keeps discard accessible when the pending room could not be joined', () => {
    const onDiscard = jest.fn();
    render(
      <GlobalPendingResultAlert
        atPendingRoom
        onDiscard={onDiscard}
        onReturn={jest.fn()}
        pendingResult={pendingResult}
        privateRoom
        status="pending"
        userId={42}
      />,
    );

    expect(screen.getByText(/Enter the room password below/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard saved result' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Discard saved result' }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('offers a return action when the user is somewhere else', () => {
    const onReturn = jest.fn();
    render(
      <GlobalPendingResultAlert
        atPendingRoom={false}
        onDiscard={jest.fn()}
        onReturn={onReturn}
        pendingResult={pendingResult}
        status="pending"
        userId={42}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Return to room' }));
    expect(onReturn).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Discard saved result' })).toBeInTheDocument();
  });

  it('does not offer discard after delivery has started', () => {
    render(
      <GlobalPendingResultAlert
        atPendingRoom={false}
        onDiscard={jest.fn()}
        onReturn={jest.fn()}
        pendingResult={markPendingResultAttempted(pendingResult)}
        status="pending"
        userId={42}
      />,
    );

    expect(screen.getByRole('button', { name: 'Return to room' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Discard saved result' })).not.toBeInTheDocument();
    expect(screen.getByText(/finish submitting/)).toBeInTheDocument();
  });
});
