import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Input from '@material-ui/core/Input';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Button from '@material-ui/core/Button';
import initialStyles from './styles';

const useStyles = makeStyles((theme) => ({
  root: {
    ...initialStyles(theme).root,
    flexDirection: 'column',
    alignItems: 'center',
  },
  input: {
    maxWidth: '300px',
    margin: 'auto',
    fontSize: '3em',
    backgroundColor: theme.palette.grey[300],
  },
  inputProps: {
    textAlign: 'center',
    '&:focus': {
      backgroundColor: theme.palette.grey[400],
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: theme.borderRadius,
    },
  },
  penaltyBox: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
}));

function parseNumericalTime(time) {
  const seconds = time % 10000;
  const minutes = ((time - seconds) / 10000) % 100;
  const hours = Math.floor((time - seconds) / 10000 / 100);
  return (seconds + minutes * 6000 + hours * 360000) * 10;
}

function parseTime(inputTime) {
  const match = inputTime.match(/^(?:(\d*):)??(?:(\d*):)?(\d+)?(?:[.,](\d*))?$/);
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  const decimalStr = match[4] || '';
  const decimal = parseInt(decimalStr || '0', 10);
  const denominator = 10 ** (decimalStr.length - 2);
  const centiSeconds = !decimal ? 0 : Math.round(decimal / denominator);

  if (!hours && !minutes && !centiSeconds) {
    return parseNumericalTime(parseInt(match[3] || '0', 10));
  }

  return (((((hours * 60) + minutes * 60) + seconds) * 100) + centiSeconds) * 10;
}

function ManualTimer({ disabled, onSubmitTime }) {
  const classes = useStyles();
  const [timeInput, setTimeInput] = React.useState('');
  const [DNF, setDNF] = React.useState(false);
  const [AUF, setAUF] = React.useState(false);

  const onSubmit = (e) => {
    e.preventDefault();
    const time = parseTime(timeInput);
    if (time) {
      onSubmitTime({
        time,
        penalties: {
          DNF,
          AUF,
        },
      });
      setAUF(false);
      setDNF(false);
      setTimeInput('');
    }
  };

  return (
    <Box className={classes.root}>
      <form onSubmit={onSubmit}>
        <Input
          className={classes.input}
          component="textarea"
          inputProps={{
            className: classes.inputProps,
          }}
          disabled={disabled}
          value={timeInput}
          onChange={(e) => setTimeInput(e.target.value)}
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
              onChange={() => setAUF(!AUF)}
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
              onChange={() => setDNF(!DNF)}
            />
          )}
          label="DNF"
        />
        <Button variant="outlined" onClick={onSubmit}>SUBMIT</Button>
      </div>
    </Box>
  );
}

ManualTimer.propTypes = {
  disabled: PropTypes.bool.isRequired,
  onSubmitTime: PropTypes.func.isRequired,
};

export default ManualTimer;
