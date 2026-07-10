import React from 'react';
import { shallow } from 'enzyme';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
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
    const wrapper = shallow(
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
    const actions = shallow(<div>{wrapper.find(Alert).prop('action')}</div>);

    expect(wrapper.text()).toContain('Enter the room password below');
    expect(actions.find(Button)).toHaveLength(1);
    expect(actions.find(Button).text()).toBe('Discard saved result');

    actions.find(Button).simulate('click');
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('offers a return action when the user is somewhere else', () => {
    const onReturn = jest.fn();
    const wrapper = shallow(
      <GlobalPendingResultAlert
        atPendingRoom={false}
        onDiscard={jest.fn()}
        onReturn={onReturn}
        pendingResult={pendingResult}
        status="pending"
        userId={42}
      />,
    );
    const actions = shallow(<div>{wrapper.find(Alert).prop('action')}</div>);

    expect(actions.find(Button).map((button) => button.text())).toEqual([
      'Return to room',
      'Discard saved result',
    ]);
    actions.find(Button).at(0).simulate('click');
    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it('does not offer discard after delivery has started', () => {
    const wrapper = shallow(
      <GlobalPendingResultAlert
        atPendingRoom={false}
        onDiscard={jest.fn()}
        onReturn={jest.fn()}
        pendingResult={markPendingResultAttempted(pendingResult)}
        status="pending"
        userId={42}
      />,
    );
    const actions = shallow(<div>{wrapper.find(Alert).prop('action')}</div>);

    expect(actions.find(Button)).toHaveLength(1);
    expect(actions.find(Button).text()).toBe('Return to room');
    expect(wrapper.text()).toContain('finish submitting');
  });
});
