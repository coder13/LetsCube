import React from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { withStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import FormGroup from '@material-ui/core/FormGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
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
  root: {
    display: 'flex',
    width: '100%',
    height: '12em',
    flexGrow: 1,
    textAlign: 'center',
    flexDirection: 'column',
    padding: 'auto',
  },
  disabled: {
    color: '#7f7f7f',
  },
  PRIMING: {
    color: 'green',
  },
  INSPECTING_PRIMING: {
    color: 'green',
  },
  INSPECTING: {
    color: 'red',
  },
}));

class Timer extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      started: undefined,
      status: STATUS.RESTING,
      time: 0,
      penalties: {
        /* inspection: false, */
        /* inspectionDNF: false, */
        /* DNF: false, */
        /* AUF: false, */
      },
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

  submitTime() {
    const { onSubmitTime } = this.props;
    const { penalties } = this.state;

    if (onSubmitTime) {
      onSubmitTime({
        time: penalties.inspectionDNF ? -1 : this.finalTime(),
        penalties: {
          DNF: penalties.DNF || penalties.inspectionDNF,
          inspection: penalties.inspection,
          AUF: penalties.AUF,
        },
      });
    }
    this.reset();
  }

  reset() {
    this.setState({
      started: 0,
      penalties: {},
    });
    this.setStatus(STATUS.RESTING);
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
        case STATUS.RESTING:
          this.setStatus(STATUS.PRIMING);
          break;
        case STATUS.INSPECTING:
          this.setStatus(STATUS.INSPECTING_PRIMING);
          break;
        default:
          break;
      }
    }

    if (status === STATUS.TIMING) {
      this.setStatus(STATUS.SUBMITTING_DOWN);
    }

    this.keyIsDown = true;
    this.forceUpdate();
  }

  keyUp(event) {
    const { focused, useInspection } = this.props;
    const { status } = this.state;

    this.keyIsDown = false;
    if (!focused) {
      return;
    }

    // Keydown and keyup for enter
    if (event.keyCode === 13 && status === STATUS.SUBMITTING) {
      event.preventDefault();
      this.submitTime();
    }

    if (event.keyCode === 32) {
      event.preventDefault();
      switch (status) {
        case STATUS.SUBMITTING_DOWN:
          this.setStatus(STATUS.SUBMITTING);
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
  }

  inspecting() {
    const { status } = this.state;
    return status.split('_')[0] === STATUS.INSPECTING;
  }

  tick() {
    const {
      status, time, started, penalties,
    } = this.state;

    if (this.inspecting()) {
      if (time < -2000) {
        // DNF + Inspection == ran out of time, just submit pure DNF
        penalties.inspectionDNF = true;
        // TODO: figure out why I need this hack.
        // The interval did not want to clear inside the tick function
        // So delay it by 1 millisecond to get it to work.
        // hopefully this doesn't break anything.
        setTimeout(() => {
          clearInterval(this.timerObj);
        }, 1);
        this.setStatus(STATUS.SUBMITTING);
      } else if (time < 0) {
        penalties.inspection = true;
      }

      this.setState({
        time: 5 * 1000 - (now() - started),
      });
    } else if (status === STATUS.TIMING) {
      this.setState({
        time: now() - started,
      });
    } else {
      console.log(216);
    }
  }

  timerText() {
    const { hideTime } = this.props;
    const { time, status } = this.state;

    if (hideTime && status === STATUS.TIMING) {
      return 'Solving...';
    }

    if (time < 0 && this.inspecting()) {
      return '+2';
    }

    return formatTime(time, {
      milli: this.inspecting() ? 0 : 2,
    });
  }

  statusText() {
    const { disabled } = this.props;
    const { status } = this.state;

    if (disabled) {
      return 'disabled';
    }

    if (status === 'SUBMITTING') {
      return 'Press Enter to Submit';
    }

    return status;
  }

  flipPenality(penalty) {
    const { penalties } = this.state;
    this.setState({
      penalties: {
        ...penalties,
        [penalty]: !penalties[penalty],
      },
    });
  }

  finalTime() {
    const { time, penalties } = this.state;

    let adjustedTime = time;

    if (penalties.inspection) {
      adjustedTime += 2000;
    }

    if (penalties.AUF) {
      adjustedTime += 2000;
    }

    return adjustedTime;
  }

  renderSubmitting() {
    const { classes } = this.props;
    const { penalties } = this.state;
    const { inspection, inspectionDNF, AUF } = penalties;
    const DNF = penalties.DNF || inspectionDNF;

    return (
      <div className={classes.root}>
        <Typography
          variant="h4"
        >
          { inspectionDNF ? 'DNF'
            : `${inspection ? '2 +' : ''}${this.timerText()}${AUF ? ' + 2' : ''} = ${DNF ? 'DNF ( ' : ''}${formatTime(this.finalTime())}${DNF ? ' )' : ''}`}
        </Typography>
        <FormGroup
          row
          style={{
            justifyContent: 'center',
          }}
        >
          <FormControlLabel
            control={<Checkbox size="medium" variant="outlined">AUF</Checkbox>}
            label="AUF"
            value={AUF}
            onChange={() => this.flipPenality('AUF')}
          />
          <FormControlLabel
            control={<Checkbox size="medium" variant="outlined">DNF</Checkbox>}
            label="DNF"
            value={DNF}
            onChange={() => this.flipPenality('DNF')}
          />
          <Button variant="outlined" onClick={() => this.submitTime()}>SUBMIT</Button>
          <Button variant="outlined" onClick={() => this.reset()}>REDO</Button>
        </FormGroup>
        <Typography
          variant="subtitle1"
        >
          Or press Enter to submit time
        </Typography>
      </div>
    );
  }

  render() {
    const { classes, disabled, useInspection } = this.props;
    const { status } = this.state;

    if (status === STATUS.SUBMITTING) {
      return this.renderSubmitting();
    }

    return (
      <div className={classes.root}>
        <Typography
          variant="h1"
          className={clsx({
            [classes.disabled]: disabled,
          }, classes[status])}
        >
          {this.timerText()}
        </Typography>
        <Typography
          variant="subtitle1"
          className={clsx({
            [classes.disabled]: disabled,
          })}
        >
          {this.statusText()}
        </Typography>
        <Typography
          variant="subtitle1"
          className={clsx({
            [classes.disabled]: disabled,
          })}
        >
          {useInspection ? 'Enabled' : 'Disabled'}
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
