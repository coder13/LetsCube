/* eslint-disable */
import StackmatSignalProcessor from 'stackmat-signal-processor';
import React from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { withStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import FormGroup from '@material-ui/core/FormGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import {
  formatTime, setInterval, clearInterval, now,
} from '../../lib/utils';
import styles from './styles';

const useStyles = withStyles(styles);

const STATUS = {
  RESTING: 'RESTING',
  PRIMING: 'PRIMING',
  INSPECTING: 'INSPECTING',
  INSPECTING_PRIMING: 'INSPECTING_PRIMING',
  TIMING: 'TIMING',
  SUBMITTING_DOWN: 'SUBMITTING_DOWN',
  SUBMITTING: 'SUBMITTING',
};

const STATUSES = [STATUS.RESTING, STATUS.INSPECTING, STATUS.TIMING, STATUS.SUBMITTING];

class Timer extends React.Component {
  constructor(props) {
    super(props);

    this.rootRef = React.createRef();

    this.state = {
      focused: true,
      status: STATUS.RESTING,
      started: undefined,
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

  async componentDidMount() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        optional: [{
          echoCancellation: false,
        }
      ]}
    });
  
    // Get the Audio Context
    const audioContext = this.audioContext = new AudioContext({
      echoCancellation: false,
      noiseSuppression: false,
    });
  
    // Create relevant Audio Nodes
    const microphone = this.microphone = audioContext.createMediaStreamSource(stream);
  
    // Connecting the StackmatSignalProcessor
    await audioContext.audioWorklet.addModule(StackmatSignalProcessor);
    // Create an Audio Node for the Stackmat Signal Processor
    const stackmatSignal = this.stackmatSignal = new AudioWorkletNode(audioContext, 'StackmatSignalProcessor');
    
    microphone.connect(stackmatSignal);
    stackmatSignal.connect(audioContext.destination);
    
    let lastEvent = undefined;
    stackmatSignal.port.onmessage = event => {
      if (!lastEvent) {
        lastEvent = event;
        return;
      }

      if (event.data.state.id < 0 && event.data.state.id !== 2) {
        return;
      }

      if (lastEvent.data.isReset && !lastEvent.data.isRunning && event.data.isRunning) {
        this.setStatus(STATUS.TIMING)
      } else if (lastEvent.data.isRunning && !event.data.isRunning) {
        this.setStatus(event.data.time ? STATUS.SUBMITTING : STATUS.RESTING);
      } else if (lastEvent.data.time && !event.data.isRunning && !event.data.time) {
        this.setStatus(STATUS.RESTING);
      }

      this.setState({
        time: event.data.time,
      });
      
      lastEvent = event;
    }

    window.addEventListener('keydown', this._keyDown, false);
    window.addEventListener('keyup', this._keyUp, false);
  }

  componentWillUnmount() {
    if (this.timerObj) {
      clearInterval(this.timerObj);
    }

    this.audioContext.close();

    window.removeEventListener('keydown', this._keyDown, false);
    window.removeEventListener('keyup', this._keyUp, false);
  }

  keyDown(event) {
    const { useInspection, disabled } = this.props;
    const { focused, status } = this.state;
    console.log(focused, this.keyIsDown, disabled);

    if (!focused || this.keyIsDown || disabled) {
      return;
    }

    if (event.keyCode === 13) {
      event.preventDefault();
    }


    if (!useInspection) {
      return;
    }

    if (event.keyCode === 27 && status === STATUS.INSPECTING) { // escape
      clearInterval(this.timerObj);
      this.reset();
    }

    if (event.keyCode === 32) { // space
      event.preventDefault();
      switch (status) {
        case STATUS.RESTING:
          this.setStatus(STATUS.PRIMING);
          break;
        default:
          break;
      }
    }

    if (status === STATUS.TIMING) {
      this.setStatus(STATUS.SUBMITTING_DOWN);
    }

    this.keyIsDown = true;
  }

  keyUp(event) {
    const { useInspection } = this.props;
    const { focused, status } = this.state;

    if (!useInspection) {
      return;
    }

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
        case STATUS.PRIMING:
          this.setStatus(STATUS.INSPECTING);
          this.setState({
            started: now(),
            time: 0,
          });
          if (this.timerObj) {
            clearInterval(this.timerObj);
          }
          this.timerObj = setInterval(this.tick.bind(this), 10);
          break;
        default:
          break;
      }
    }
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
        time: 15 * 1000 - (now() - started),
      });
    }
  }

  setStatus (status) {
    this.setState({ status });

    if (STATUSES.indexOf(status) > -1) {
      this.props.onStatusChange(status);
    }
  }

  submitTime(event) {
    const { onSubmitTime } = this.props;
    const { penalties } = this.state;

    if (event) event.preventDefault();

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

  inspecting() {
    const { status } = this.state;
    return status.split('_')[0] === STATUS.INSPECTING;
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

  onEnter(e) {
    e.preventDefault();
  }

  renderSubmitting() {
    const { penalties } = this.state;
    const { inspection, inspectionDNF, AUF } = penalties;
    const DNF = penalties.DNF || inspectionDNF;

    const penaltyHalf = `${inspection ? '2 +' : ''}${this.timerText()}${AUF ? ' + 2' : ''} = `;
    const finalTimeHalf = formatTime(this.finalTime(), penalties);
    const editingTime = ((AUF || inspection || DNF) ? penaltyHalf : '') + finalTimeHalf;

    return (
      <div>
        <Typography
          variant="h4"
        >
          { inspectionDNF ? 'DNF' : editingTime}
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

  renderTiming() {
    const { classes, disabled } = this.props;
    const { focused, status } = this.state;

    return (
      <>
        <p style={{paddingTop: '1em'}}>Stackmat (beta)</p>
        <Typography
          className={clsx(classes.timerText, {
            [classes.disabled]: disabled || !focused,
          }, classes[status])}
        >
          {this.timerText()}
        </Typography>
        {process.env.NODE_ENV === 'development' ? disabled : ''}
        {process.env.NODE_ENV === 'development' ? status : ''}
      </>
    );
  }

  render() {
    const { classes } = this.props;
    const { status } = this.state;

    return (
      <Box
        className={clsx(classes.root, {
          [classes.fullscreen]: status !== STATUS.RESTING,
        })}
        ref={this.rootRef}
      >
        {status === STATUS.SUBMITTING ? this.renderSubmitting() : this.renderTiming()}
      </Box>
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
  onStatusChange: PropTypes.func,
  onPriming: PropTypes.func,
};

Timer.defaultProps = {
  disabled: false,
  hideTime: false,
  focused: true,
  onStatusChange: () => {},
  onPriming: () => {},
};

export default useStyles(Timer);
