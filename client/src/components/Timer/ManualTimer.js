import React from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { withStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import Input from '@material-ui/core/Input';
import Checkbox from '@material-ui/core/Checkbox';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import {
  formatTime, parseTime, setInterval, clearInterval, now,
} from '../../lib/utils';
import initialStyles from './styles';

const useStyles = withStyles((theme) => ({
  ...initialStyles(theme),
  input: {
    maxWidth: '300px',
    margin: 'auto',
    fontSize: '2.5em',
    backgroundColor: theme.palette.background.default,
    border: `1px solid ${theme.palette.divider}`,
  },
  inputProps: {
    textAlign: 'center',
    border: `1px solid ${theme.palette.background.paper}`,
    '&:focus': {
      backgroundColor: theme.palette.background.paper,
      border: `1px solid ${theme.palette.primary.main}`,
      borderRadius: theme.borderRadius,
    },
  },
}));

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
  SUBMITTING: 'SUBMITTING',
};

const STATUSES = [STATUS.RESTING, STATUS.INSPECTING, STATUS.TIMING, STATUS.SUBMITTING];

class ManualTimer extends React.Component {
  constructor(props) {
    super(props);

    this.rootRef = React.createRef();

    this.state = {
      focused: true,
      started: undefined,
      status: STATUS.RESTING,
      inspection: 0,
      timeInput: '',
      penalties: {
        /* inspection: false, */
        /* inspectionDNF: false, */
        /* DNF: false, */
        /* AUF: false, */
      },
    };

    this._keyDown = this.keyDown.bind(this);
    this._keyUp = this.keyUp.bind(this);
    this._touchStart = this.touchStart.bind(this);
    this._touchEnd = this.touchEnd.bind(this);
  }

  componentDidMount() {
    const { useInspection } = this.props;

    if (useInspection) {
      window.addEventListener('keydown', this._keyDown, false);
      window.addEventListener('keyup', this._keyUp, false);

      if (this.rootRef.current) {
        this.rootRef.current.addEventListener('touchstart', this._touchStart);
        this.rootRef.current.addEventListener('touchend', this._touchEnd);
      }
    }
  }

  componentDidUpdate() {
    const { useInspection } = this.props;

    if (useInspection) {
      window.addEventListener('keydown', this._keyDown, false);
      window.addEventListener('keyup', this._keyUp, false);

      if (this.rootRef.current) {
        this.rootRef.current.addEventListener('touchstart', this._touchStart);
        this.rootRef.current.addEventListener('touchend', this._touchEnd);
      }
    } else {
      window.removeEventListener('keydown', this._keyDown, false);
      window.removeEventListener('keyup', this._keyUp, false);

      if (this.rootRef.current) {
        this.rootRef.current.removeEventListener('touchstart', this._touchStart, false);
        this.rootRef.current.removeEventListener('touchend', this._touchEnd, false);
      }
    }
  }

  componentWillUnmount() {
    if (this.timerObj) {
      clearInterval(this.timerObj);
    }

    const { useInspection } = this.props;

    if (useInspection) {
      window.removeEventListener('keydown', this._keyDown, false);
      window.removeEventListener('keyup', this._keyUp, false);

      if (this.rootRef.current) {
        this.rootRef.current.removeEventListener('touchstart', this._touchStart, false);
        this.rootRef.current.removeEventListener('touchend', this._touchEnd, false);
      }
    }
  }

  setStatus(status) {
    const { onStatusChange, onPriming } = this.props;
    this.setState({ status });

    switch (status) {
      case STATUS.PRIMING:
        onPriming();
        break;
      case STATUS.INSPECTING:
        this.setState({
          started: now(),
          inspection: 0,
        });
        if (this.timerObj) {
          clearInterval(this.timerObj);
        }
        this.timerObj = setInterval(this.tick.bind(this), 1000);
        break;
      case STATUS.TIMING:
        this.setState({
          started: now(),
          inspection: 0,
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

    if (STATUSES.indexOf(status) > -1) {
      onStatusChange(status);
    }
  }

  handleTimeInputChange(e) {
    this.setState({
      timeInput: e.target.value,
    });
  }

  submitTime(e) {
    e.preventDefault();

    const { onSubmitTime } = this.props;
    const { penalties } = this.state;

    if (onSubmitTime) {
      onSubmitTime({
        time: this.finalTime(),
        penalties: {
          DNF: penalties.DNF,
          inspection: penalties.inspection,
          AUF: penalties.AUF,
        },
      });
    }
    this.reset();
  }

  reset() {
    this.setState({
      inspection: 0,
      timeInput: '',
      started: 0,
      penalties: {},
    });
    this.setStatus(STATUS.RESTING);
  }

  keyDown(event) {
    const { disabled } = this.props;
    const { focused, status } = this.state;

    if (!focused || this.keyIsDown || disabled) {
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
  }

  keyUp(event) {
    const { focused, status } = this.state;

    this.keyIsDown = false;
    if (!focused) {
      return;
    }

    if (event.keyCode === 32) {
      event.preventDefault();
      switch (status) {
        case STATUS.PRIMING:
          this.setStatus(STATUS.INSPECTING);
          break;
        case STATUS.INSPECTING_PRIMING:
          this.setStatus(STATUS.SUBMITTING);
          break;
        default:
          break;
      }
    }

    if (status === STATUS.SUBMITTING_DOWN) {
      this.setStatus(STATUS.SUBMITTING);
    }
  }

  touchStart(e) {
    const { focused, disabled } = this.props;
    const { status } = this.state;

    if (!focused || this.keyIsDown || disabled) {
      return;
    }

    switch (status) {
      case STATUS.RESTING:
        e.preventDefault();
        this.setStatus(STATUS.PRIMING);
        break;
      case STATUS.INSPECTING:
        this.setStatus(STATUS.INSPECTING_PRIMING);
        break;
      default:
        break;
    }

    this.keyIsDown = true;
  }

  touchEnd(e) {
    const { status } = this.state;
    this.keyIsDown = false;

    if (status === STATUS.SUBMITTING_DOWN) {
      e.preventDefault();
    }

    switch (status) {
      case STATUS.SUBMITTING_DOWN:
        this.setStatus(STATUS.SUBMITTING);
        break;
      case STATUS.PRIMING:
        this.setStatus(STATUS.INSPECTING);
        break;
      case STATUS.INSPECTING_PRIMING:
        this.setStatus(STATUS.SUBMITTING);
        break;
      default:
        break;
    }
  }

  inspecting() {
    const { status } = this.state;
    return status.split('_')[0] === STATUS.INSPECTING;
  }

  tick() {
    const {
      inspection, started,
    } = this.state;

    if (this.inspecting()) {
      if (inspection < 0) {
        setTimeout(() => {
          clearInterval(this.timerObj);
        }, 1);
        this.setStatus(STATUS.SUBMITTING);
      }

      this.setState({
        inspection: 15 * 1000 - (now() - started),
      });
    }
  }

  timerText() {
    const { inspection } = this.state;

    return formatTime(inspection, {
      milli: 0,
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
    const { timeInput, penalties } = this.state;

    let adjustedTime = parseTime(timeInput);

    if (penalties.inspection) {
      adjustedTime += 2000;
    }

    if (penalties.AUF) {
      adjustedTime += 2000;
    }

    return adjustedTime;
  }

  renderResting() {
    const { classes } = this.props;
    const { status } = this.state;

    return (
      <div
        className={clsx({
          [classes.PRIMING]: status === STATUS.PRIMING,
        })}
      >
        <Typography variant="h5">
          Press Space to start inspecting
        </Typography>
      </div>
    );
  }

  renderSubmitting() {
    const { classes, disabled } = this.props;
    const { penalties, timeInput } = this.state;
    const { AUF, DNF, inspection } = penalties;

    return (
      <>
        <form onSubmit={(e) => this.submitTime(e)}>
          <Input
            className={classes.input}
            component="textarea"
            inputProps={{
              className: classes.inputProps,
            }}
            autoFocus
            inputRef={this.inputRef}
            disabled={disabled}
            value={timeInput}
            onChange={(e) => this.handleTimeInputChange(e)}
            disableUnderline
            fullWidth
          />
        </form>
        <div className={classes.penaltyBox}>
          <FormControlLabel
            control={(
              <Checkbox
                size="medium"
                variant="outlined"
                checked={AUF}
                onChange={() => this.flipPenality('AUF')}
              />
          )}
            label="AUF"
          />
          <FormControlLabel
            control={(
              <Checkbox
                size="medium"
                variant="outlined"
                checked={DNF}
                onChange={() => this.flipPenality('DNF')}
              />
          )}
            label="DNF"
          />
          <FormControlLabel
            control={(
              <Checkbox
                size="medium"
                variant="outlined"
                checked={inspection}
                onChange={() => this.flipPenality('inspection')}
              />
          )}
            label="Inspection"
          />
          <Button variant="outlined" onClick={(e) => this.submitTime(e)}>SUBMIT</Button>
        </div>
      </>
    );
  }

  renderInspecting() {
    const { classes, disabled } = this.props;
    const { focused, status } = this.state;

    return (
      <>
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

  renderByState() {
    const { useInspection } = this.props;
    const { status } = this.state;

    if (useInspection) {
      switch (status) {
        case STATUS.RESTING:
        case STATUS.PRIMING:
          return this.renderResting();
        case STATUS.INSPECTING:
        case STATUS.INSPECTING_PRIMING:
          return this.renderInspecting();
        case STATUS.SUBMITTING:
          return this.renderSubmitting();
        default:
          break;
      }
    }

    return this.renderSubmitting();
  }

  render() {
    const { classes } = this.props;

    return (
      <Box
        className={classes.root}
        ref={this.rootRef}
      >
        { this.renderByState() }
      </Box>
    );
  }
}

ManualTimer.propTypes = {
  disabled: PropTypes.bool,
  focused: PropTypes.bool,
  onSubmitTime: PropTypes.func.isRequired,
  useInspection: PropTypes.bool.isRequired,
  classes: PropTypes.shape().isRequired,
  onStatusChange: PropTypes.func,
  onPriming: PropTypes.func,
};

ManualTimer.defaultProps = {
  disabled: false,
  focused: true,
  onStatusChange: () => {},
  onPriming: () => {},
};

export default useStyles(ManualTimer);
