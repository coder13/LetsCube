/* eslint-disable react/jsx-props-no-spreading */
import React from 'react';
import PropTypes from 'prop-types';
import SpacebarTimer from './SpacebarTimer';
import ManualTimer from './ManualTimer';

const timers = {
  spacebar: SpacebarTimer,
  manual: ManualTimer,
};

function Timer({
  type, disabled, focused, onSubmitTime, ...other
}) {
  const TimerComponent = timers[type];

  return (
    <TimerComponent
      disabled={disabled}
      focused={focused}
      onSubmitTime={onSubmitTime}
      {...other}
    />
  );
}

Timer.propTypes = {
  type: PropTypes.oneOf(['spacebar', 'manual']),
  disabled: PropTypes.bool,
  focused: PropTypes.bool,
  onSubmitTime: PropTypes.func.isRequired,
  onStatusChange: PropTypes.func,
};

Timer.defaultProps = {
  type: 'spacebar',
  disabled: false,
  focused: true,
  onStatusChange: () => {},
};

export default Timer;
