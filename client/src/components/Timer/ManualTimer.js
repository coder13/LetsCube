import React from 'react';
// import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Input from '@material-ui/core/Input';
import initialStyles from './styles';

const useStyles = makeStyles((theme) => ({
  root: {
    ...initialStyles(theme).root,
  },
  input: {
    maxWidth: '200px',
    margin: 'auto',
  },
}));

function ManualTimer() {
  const classes = useStyles();

  return (
    <Box className={classes.root}>
      <Input
        className={classes.input}
        value="0"
      />
    </Box>
  );
}

ManualTimer.propTypes = {
  // onSubmitTime: PropTypes.func.isRequired,
  // disabled: PropTypes.bool.isRequired,
  // focused: PropTypes.bool.isRequired,
};

export default ManualTimer;
