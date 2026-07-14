import React from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Timer from '../../Timer/index';
import ScramblePreview from '../../common/ScramblePreview';
import { Main } from './Main';
import {
  createPendingResult,
  markPendingResultAttempted,
} from '../../../store/room/resultOutbox';
import {
  DISCARD_PENDING_RESULT,
  SUBMIT_RESULT,
} from '../../../store/room/actions';

jest.mock('../../Timer/StackmatTimer', () => () => null);

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

const findElements = (node, type) => {
  if (!React.isValidElement(node)) return [];
  const children = React.Children.toArray(node.props.children)
    .flatMap((child) => findElements(child, type));
  return node.type === type ? [node, ...children] : children;
};

const makeProps = (overrides = {}) => ({
  classes: {
    root: 'root',
    submissionAlert: 'submissionAlert',
    scrambleBox: 'scrambleBox',
    waitingForBox: 'waitingForBox',
  },
  dispatch: jest.fn(),
  onlyShowSelf: false,
  roomConnected: true,
  user: {
    id: 42,
    useInspection: false,
    muteTimer: true,
    timerType: 'spacebar',
  },
  room: {
    _id: 'current-room',
    event: '333',
    users: [{ id: 42 }],
    competing: { 42: true },
    waitingFor: { 42: true },
    attempts: [{ _id: 'attempt-eight', id: 8, scrambles: ['R U'], results: {} }],
    timerFocused: true,
    resultSubmission: {
      status: 'pending',
      pendingResult,
      error: null,
    },
  },
  ...overrides,
});

const createMain = (props) => {
  const main = new Main(props);
  main.setState = (update) => {
    main.state = { ...main.state, ...update };
  };
  return main;
};

describe('room pending result UX', () => {
  it('shows scramble previews for non-3x3 events', () => {
    const props = makeProps({
      room: { ...makeProps().room, event: 'pyram' },
    });
    const previews = findElements(createMain(props).render(), ScramblePreview);

    expect(previews[0].props).toMatchObject({
      event: 'pyram',
      scramble: 'R U',
    });
  });

  it('submits against the immutable attempt that was primed', () => {
    const props = makeProps({
      room: {
        ...makeProps().room,
        attempts: [{
          _id: 'primed-attempt', id: 0, scrambles: ['R U'], results: {},
        }],
        resultSubmission: {
          status: 'idle',
          pendingResult: null,
          error: null,
        },
      },
    });
    const main = createMain(props);
    main.handlePriming();
    main.props = {
      ...props,
      room: {
        ...props.room,
        attempts: [{
          _id: 'replacement-attempt', id: 0, scrambles: ['F R'], results: {},
        }],
      },
    };

    main.onSubmitTime({ time: 1234, penalties: {} });

    expect(props.dispatch).toHaveBeenCalledWith({
      type: SUBMIT_RESULT,
      result: {
        id: 0,
        attemptKey: 'primed-attempt',
        result: { time: 1234, penalties: {} },
      },
    });
  });

  it('does not disable the timer merely because the room socket disconnected', () => {
    const props = makeProps({
      roomConnected: false,
      room: {
        ...makeProps().room,
        resultSubmission: {
          status: 'idle',
          pendingResult: null,
          error: null,
        },
      },
    });
    const tree = createMain(props).render();

    expect(findElements(tree, Timer)[0].props.disabled).toBe(false);
    expect(findElements(tree, Alert)).toHaveLength(0);
  });

  it('blocks another solve and offers return/discard actions outside the original room', () => {
    const props = makeProps();
    const alert = findElements(createMain(props).render(), Alert)[0];
    const buttons = findElements(alert.props.action, Button);

    expect(findElements(createMain(props).render(), Timer)[0].props.disabled).toBe(true);
    expect(alert.props.children).toContain('Your saved time belongs to room original-room.');
    expect(buttons.map((button) => button.props.children)).toEqual([
      'Return to room',
      'Discard saved result',
    ]);

    buttons[1].props.onClick();
    expect(props.dispatch).toHaveBeenCalledWith({
      type: DISCARD_PENDING_RESULT,
      submissionId: 'submission-one',
    });
  });

  it('also blocks a solve when the device outbox belongs to another account', () => {
    const anotherUsersResult = { ...pendingResult, userId: 99 };
    const props = makeProps({
      room: {
        ...makeProps().room,
        resultSubmission: {
          status: 'pending',
          pendingResult: anotherUsersResult,
          error: null,
        },
      },
    });
    const alert = findElements(createMain(props).render(), Alert)[0];

    expect(findElements(createMain(props).render(), Timer)[0].props.disabled).toBe(true);
    expect(alert.props.children).toContain('another account');
    expect(findElements(alert.props.action, Button)).toHaveLength(1);
    expect(findElements(alert.props.action, Button)[0].props.children).toBe('Discard saved result');
  });

  it('keeps an attempted result without offering discard', () => {
    const props = makeProps({
      room: {
        ...makeProps().room,
        resultSubmission: {
          status: 'pending',
          pendingResult: markPendingResultAttempted(pendingResult),
          error: null,
        },
      },
    });
    const alert = findElements(createMain(props).render(), Alert)[0];
    const buttons = findElements(alert.props.action, Button);

    expect(buttons).toHaveLength(1);
    expect(buttons[0].props.children).toBe('Return to room');
    expect(alert.props.children).toContain('finish submitting');
  });
});
