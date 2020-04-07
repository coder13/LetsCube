import React from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { withStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import {
  formatTime, setInterval, clearInterval, now,
} from '../lib/utils';

/*
  Complicated beast.

  Hold spacebar for X seconds before timer is priming. Holding spacebar makes it priming.
  Based on different settings, needs to either start inspection, or start timer.
  Once spacebar is pressed again (again, need to prime)


  Status: Resting, priming, inspecting, inspecting-priming, timing, submitting

  submitting: needs to display buttons to ask if it was a penalty.
    - Comment?
    - OK
    - +2
    - DNF
    - REDO?
*/

const STATUS = {
  RESTING: 'RESTING',
  PRIMING: 'PRIMING',
  INSPECTING: 'INSPECTING',
  INSPECTING_PRIMING: 'INSPECTING_PRIMING',
  TIMING: 'TIMING',
  SUBMITTING_DOWN: 'SUBMITTING_DOWN',
  SUBMITTING: 'SUBMITTING',
};

const useStyles = withStyles(() => ({
  disabled: {
    color: '#7f7f7f',
  },
  priming: {
    color: 'green',
  },
}));

class Timer extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      status: STATUS.RESTING,
      time: 0,
    };

    this._keyDown = this.keyDown.bind(this);
    this._keyUp = this.keyUp.bind(this);
  }

  componentDidMount() {
    window.addEventListener('keydown', this._keyDown, false);
    window.addEventListener('keyup', this._keyUp, false);
  }

  componentWillUnmount() {
    if (this.timerObj) {
      clearInterval(this.timerObj);
    }

    window.removeEventListener('keydown', this._keyDown, false);
    window.removeEventListener('keyup', this._keyUp, false);
  }

  setStatus(status) {
    this.setState({ status });

    switch (status) {
      case STATUS.INSPECTING:
        this.setState({
          started: now(),
          time: 0,
        });
        if (this.timerObj) {
          clearInterval(this.timerObj);
        }
        this.timerObj = setInterval(this.tick.bind(this), 1000);
        break;
      case STATUS.TIMING:
        clearInterval(this.timerObj);
        this.setState({
          started: now(),
          time: 0,
        });
        if (this.timerObj) {
          clearInterval(this.timerObj);
        }
        this.timerObj = setInterval(this.tick.bind(this), 10);
        break;
      case STATUS.SUBMITTING_DOWN:
        clearInterval(this.timerObj);
        break;
      default:
        break;
    }
  }

  keyDown(event) {
    const { focused, disabled } = this.props;
    const { status } = this.state;

    if (!focused || this.keyIsDown || disabled) {
      return;
    }

    if (event.keyCode === 32) {
      event.preventDefault();

      switch (status) {
        case STATUS.TIMING:
          this.setStatus(STATUS.SUBMITTING_DOWN);
          break;
        case STATUS.RESTING:
          this.setStatus(STATUS.PRIMING);
          break;
        default:
          break;
      }
    }

    this.keyIsDown = true;
    this.forceUpdate();
  }

  keyUp(event) {
    const { focused, onSubmitTime, useInspection } = this.props;
    const { status, time } = this.state;

    this.keyIsDown = false;
    if (!focused) {
      return;
    }

    if (event.keyCode === 32) {
      event.preventDefault();

      switch (status) {
        case STATUS.SUBMITTING_DOWN:
          this.setStatus(STATUS.SUBMITTING);
          break;
        case STATUS.SUBMITTING:
          if (onSubmitTime) {
            onSubmitTime({
              time,
            });
          }
          this.setStatus(STATUS.RESTING);
          break;
        case STATUS.PRIMING:
          this.setStatus(useInspection ? STATUS.INSPECTING : STATUS.TIMING);
          break;
        case STATUS.INSPECTING_PRIMING:
          this.setStatus(STATUS.TIMING);
          break;
        default:
          break;
      }
    }

    this.forceUpdate();
  }

  tick() {
    const { status, time, started } = this.state;

    if (status === STATUS.INSPECTING) {
      if (time < 0) {
        // TODO: implement inspection
        // this.setState({
        //   inspectionHasBeenBroken: true,
        // });
      }

      this.setState({
        time: 15 * 1000 - (now() - started),
      });
    } else {
      this.setState({
        time: now() - started,
      });
    }
  }

  timerText() {
    const { hideTime } = this.props;
    const { time, status } = this.state;

    // let milli = !(this.state.status === STATUS.INSPECTING);
    let text = formatTime(time, {
      milli: 2,
      inspecting: status === STATUS.INSPECTING,
    });

    if (hideTime && status === STATUS.TIMING) {
      text = 'Solving...';
    }

    return text;
  }

  render() {
    const { classes, disabled } = this.props;
    const { status } = this.state;

    let statusText;

    if (disabled) {
      statusText = 'disabled';
    } else {
      statusText = status === 'SUBMITTING' ? 'Press Space to Submit' : status;
    }

    return (
      <div style={{
        display: 'flex',
        width: '100%',
        flexGrow: 1,
        textAlign: 'center',
        flexDirection: 'column',
        padding: 'auto',
      }}
      >
        <Typography
          variant="h1"
          className={clsx({
            [classes.disabled]: disabled,
            [classes.priming]: status === STATUS.PRIMING,
          })}
        >
          {this.timerText()}
        </Typography>
        <Typography
          variant="subtitle1"
          className={clsx({
            [classes.disabled]: disabled,
          })}
        >
          {statusText}
        </Typography>
      </div>
    );
  }
}

Timer.propTypes = {
  disabled: PropTypes.bool,
  focused: PropTypes.bool,
  onSubmitTime: PropTypes.func.isRequired,
  useInspection: PropTypes.bool.isRequired,
  hideTime: PropTypes.bool,
  classes: PropTypes.shape().isRequired,
};

Timer.defaultProps = {
  disabled: false,
  focused: true,
  hideTime: false,
};

export default useStyles(Timer);
