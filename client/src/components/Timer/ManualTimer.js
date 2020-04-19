import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Input from '@material-ui/core/Input';
import initialStyles from './styles';

const useStyles = makeStyles((theme) => ({
  root: {
    ...initialStyles(theme).root,
  },
  input: {
    maxWidth: '300px',
    margin: 'auto',
    fontSize: '4em',
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
}));

function parseNumericalTime(time) {
  const seconds = time % 10000;
  const minutes = (time - seconds) / 10000;
  return (seconds + minutes * 60 * 100) * 10;
}

function parseTime(inputTime) {
  const time = +inputTime;

  if (Number.isNaN(time)) {
    return false;
  }

  return parseNumericalTime(time);
}

function ManualTimer({ disabled, onSubmitTime }) {
  const classes = useStyles();
  const [timeInput, setTimeInput] = React.useState('');
  const [DNF] = React.useState(false);
  const [AUF] = React.useState(false);

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
    </Box>
  );
}

ManualTimer.propTypes = {
  disabled: PropTypes.bool.isRequired,
  onSubmitTime: PropTypes.func.isRequired,
  // focused: PropTypes.bool.isRequired,
};

export default ManualTimer;
