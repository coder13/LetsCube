import React from 'react';
import { shallow } from 'enzyme';
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

describe('manual timer submission', () => {
  it.each(['', 'not-a-time'])('keeps invalid input for correction: %p', (timeInput) => {
    const props = makeProps();
    const wrapper = shallow(<ManualTimer {...props} />);
    wrapper.setState({ timeInput });

    wrapper.instance().submitTime({ preventDefault: jest.fn() });

    expect(props.onSubmitTime).not.toHaveBeenCalled();
    expect(wrapper.state('timeInput')).toBe(timeInput);
  });

  it('submits and resets a valid time', () => {
    const props = makeProps();
    const wrapper = shallow(<ManualTimer {...props} />);
    wrapper.setState({ timeInput: '5.00' });

    wrapper.instance().submitTime({ preventDefault: jest.fn() });

    expect(props.onSubmitTime).toHaveBeenCalledWith({
      time: 5000,
      penalties: {
        AUF: false,
        DNF: false,
        inspection: false,
      },
    });
    expect(wrapper.state('timeInput')).toBe('');
  });
});
