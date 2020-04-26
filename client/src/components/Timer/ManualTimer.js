import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Input from '@material-ui/core/Input';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Button from '@material-ui/core/Button';
import initialStyles from './styles';
import { parseTime } from '../../lib/utils';

const useStyles = makeStyles((theme) => ({
  root: {
    ...initialStyles(theme).root,
    flexDirection: 'column',
    alignItems: 'center',
  },
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
  penaltyBox: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
}));

function ManualTimer({ disabled, onSubmitTime }) {
  const classes = useStyles();
  const [timeInput, setTimeInput] = React.useState('');
  const [DNF, setDNF] = React.useState(false);
  const [AUF, setAUF] = React.useState(false);
  const inputRef = React.createRef(null);

  const finalTime = (time) => time + (AUF ? 2000 : 0);

  const onSubmit = (e) => {
    e.preventDefault();
    const time = parseTime(timeInput);

    if (time) {
      onSubmitTime({
        time: finalTime(time),
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

  React.useEffect(() => {
    inputRef.current.focus();
  });

  return (
    <Box className={classes.root}>
      <form onSubmit={onSubmit}>
        <Input
          className={classes.input}
          component="textarea"
          inputProps={{
            className: classes.inputProps,
          }}
          inputRef={inputRef}
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
