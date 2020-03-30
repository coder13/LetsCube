import React from 'react';
import { withStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import { formatTime } from '../lib/utils';

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

// Better refresh and cross compatability. 
const requestAnimationFrame =
  window.requestAnimationFrame || window.webkitRequestAnimationFrame ||
  window.mozRequestAnimationFrame || window.oRequestAnimationFrame ||
  window.msRequestAnimationFrame ||
  function(fn) { return window.setTimeout(fn, 1000 / 60); };

const cancelAnimationFrame =
  window.cancelAnimationFrame || window.webkitCancelAnimationFrame ||
  window.mozCancelRequestAnimationFrame ||
  window.oCancelRequestAnimationFrame ||
  window.msCancelRequestAnimationFrame || window.clearTimeout;

const setInterval = function (fn, delay) {
  // Have to use an object here to store a reference
  // to the requestAnimationFrame ID.
  let handle = {};

  let interval = function () {
    fn.call();
    handle.value = requestAnimationFrame(interval);
  };

  handle.value = requestAnimationFrame(interval);
  return handle;
};

const clearInterval = function (interval) {
  if (interval) {
    cancelAnimationFrame(interval.value);
  }
};

const now = function () {
  return (window.performance && window.performance.now
    ? window.performance.now.bind(window.performance)
    : Date.now)();
};

const styles = theme => ({

});

class Timer extends React.Component {
  displayName: 'Timer'

  constructor (props) {
    super(props)

    this.state = {
      status: STATUS.RESTING,
      time: 0,
      focused: true
    };
  }

  componentWillMount () {
    window.addEventListener('keydown', this.keyDown.bind(this));
    window.addEventListener('keyup', this.keyUp.bind(this));
  }

  componentWillUnmount() {
    if (this.timerObj) {
      clearInterval(this.timerObj);
    }

    window.removeEventListener('keydown', this.keyDown.bind(this));
    window.removeEventListener('keyup', this.keyUp.bind(this));
  }

  keyDown(event) {
    if (!this.state.focused || this.keyIsDown) {
      return;
    }

    if (event.keyCode === 32) {
      event.preventDefault();

      switch (this.state.status) {
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
    this.keyIsDown = false;
    if (!this.state.focused) {
      return;
    }

    if (event.keyCode === 32) {
      event.preventDefault();

      switch (this.state.status) {
        case STATUS.SUBMITTING_DOWN:
          this.setStatus(STATUS.SUBMITTING);
          break;
        case STATUS.SUBMITTING:
          if (this.props.onSubmitTime) {
            this.props.onSubmitTime({
              time: this.state.time,
            });
          }
          this.setStatus(STATUS.RESTING);
          break;
        case STATUS.PRIMING:
          this.setStatus(this.props.inspection ? STATUS.INSPECTING : STATUS.TIMING);
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

  setStatus(status) {
    this.setState({status});

    switch (status) {
      case STATUS.INSPECTING:
        this.setState({
          started: now(),
          time: 0
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
          time: 0
        });
        if (this.timerObj) {
          clearInterval(this.timerObj);
        }
        this.timerObj = setInterval(this.tick.bind(this), 10);
        break;
      case STATUS.SUBMITTING_DOWN:
        clearInterval(this.timerObj);
        if (this.props.updateTime) {
          this.props.updateTime(this.state.time, this.state.inspectionHasBeenBroken, false);
        }
        break;
      default:
        break;
    }
  }

  tick() {
    if (this.state.status === STATUS.INSPECTING) {
      if (this.state.time < 0) {
        this.setState({
          inspectionHasBeenBroken: true
        });
      }
  
      this.setState({
        time: 15 * 1000 - (now() - this.state.started)
      });
    } else {
      this.setState({
        time: now() - this.state.started
      });
    }
  }

  timerText() {
    // let milli = !(this.state.status === STATUS.INSPECTING);
    let text = formatTime(this.state.time, {
      milli: 2,
      inspecting: this.state.status === STATUS.INSPECTING
    });

    if (this.props.hideTime && this.state.status === STATUS.TIMING) {
      text = 'Solving...';
    }

    return text;
  }

  render () {
    const { status } = this.state;

    return (
      <div style={{
        display: 'flex',
        width: '100%',
        flexGrow: 1,
        textAlign: 'center',
        flexDirection: 'column',
        padding: 'auto'
      }}>
        <Typography variant='h1' style={{
          color: (status === STATUS.PRIMING || status === STATUS.SUBMITTING_DOWN) ? 'green' : 'black'
        }}>{this.timerText()}</Typography>
        <Typography variant='subtitle1'>{status === 'SUBMITTING' ? 'Press Space to Submit' : status}</Typography>
      </div>
    );
  }
}
export default withStyles(styles)(Timer);