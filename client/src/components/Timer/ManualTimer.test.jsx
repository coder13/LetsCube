import { ManualTimer } from './ManualTimer';

const makeProps = () => ({
  classes: {
    root: 'root',
    input: 'input',
    inputProps: 'inputProps',
    penaltyBox: 'penaltyBox',
  },
  onPriming: jest.fn(),
  onStatusChange: jest.fn(),
  onSubmitTime: jest.fn(),
  useInspection: false,
});

const createTimer = (props) => {
  const timer = new ManualTimer(props);
  timer.setState = (update) => {
    timer.state = { ...timer.state, ...update };
  };
  return timer;
};

describe('manual timer submission', () => {
  it.each(['', 'not-a-time'])('keeps invalid input for correction: %p', (timeInput) => {
    const props = makeProps();
    const timer = createTimer(props);
    timer.state.timeInput = timeInput;

    timer.submitTime({ preventDefault: jest.fn() });

    expect(props.onSubmitTime).not.toHaveBeenCalled();
    expect(timer.state.timeInput).toBe(timeInput);
  });

  it('submits and resets a valid time', () => {
    const props = makeProps();
    const timer = createTimer(props);
    timer.state.timeInput = '5.00';

    timer.submitTime({ preventDefault: jest.fn() });

    expect(props.onSubmitTime).toHaveBeenCalledWith({
      time: 5000,
      penalties: {
        AUF: false,
        DNF: false,
        inspection: false,
      },
    });
    expect(timer.state.timeInput).toBe('');
  });
});
