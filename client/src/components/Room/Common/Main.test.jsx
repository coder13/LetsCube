import React from 'react';
import { shallow } from 'enzyme';
import Alert from '@material-ui/lab/Alert';
import Button from '@material-ui/core/Button';
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

describe('room pending result UX', () => {
  it('shows scramble previews for non-3x3 events', () => {
    const props = makeProps({
      room: { ...makeProps().room, event: 'pyram' },
    });
    const wrapper = shallow(<Main {...props} />);

    expect(wrapper.find(ScramblePreview).props()).toMatchObject({
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
    const wrapper = shallow(<Main {...props} />);
    wrapper.instance().handlePriming();
    wrapper.setProps({
      room: {
        ...props.room,
        attempts: [{
          _id: 'replacement-attempt', id: 0, scrambles: ['F R'], results: {},
        }],
      },
    });

    wrapper.instance().onSubmitTime({ time: 1234, penalties: {} });

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
    const wrapper = shallow(<Main {...props} />);

    expect(wrapper.find(Timer).prop('disabled')).toBe(false);
    expect(wrapper.find(Alert)).toHaveLength(0);
  });

  it('blocks another solve and offers return/discard actions outside the original room', () => {
    const props = makeProps();
    const wrapper = shallow(<Main {...props} />);
    const actions = shallow(<div>{wrapper.find(Alert).prop('action')}</div>);

    expect(wrapper.find(Timer).prop('disabled')).toBe(true);
    expect(wrapper.find(Alert).text()).toContain('Your saved time belongs to room original-room.');
    expect(actions.find(Button).map((button) => button.text())).toEqual([
      'Return to room',
      'Discard saved result',
    ]);

    actions.find(Button).at(1).simulate('click');
    expect(props.dispatch).toHaveBeenCalledWith({
      type: DISCARD_PENDING_RESULT,
      submissionId: 'submission-one',
    });
  });

  it('also blocks a solve when the device outbox belongs to another account', () => {
    const anotherUsersResult = {
      ...pendingResult,
      userId: 99,
    };
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
    const wrapper = shallow(<Main {...props} />);
    const actions = shallow(<div>{wrapper.find(Alert).prop('action')}</div>);

    expect(wrapper.find(Timer).prop('disabled')).toBe(true);
    expect(wrapper.find(Alert).text()).toContain('another account');
    expect(actions.find(Button)).toHaveLength(1);
    expect(actions.find(Button).text()).toBe('Discard saved result');
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
    const wrapper = shallow(<Main {...props} />);
    const actions = shallow(<div>{wrapper.find(Alert).prop('action')}</div>);

    expect(actions.find(Button)).toHaveLength(1);
    expect(actions.find(Button).text()).toBe('Return to room');
    expect(wrapper.find(Alert).text()).toContain('finish submitting');
  });
});
