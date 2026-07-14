import React from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { makeStyles } from '@mui/styles';
import Typography from '@mui/material/Typography';

const useStyles = makeStyles((theme) => ({
  root: {
    '-webkit-user-select': 'text',
    '-webkit-touch-callout': 'text',
    '-moz-user-select': 'text',
    '-ms-user-select': 'text',
    'user-select': 'text',
  },
  scramble: {
    fontFamily: 'Roboto Mono, monospace',
  },
  disabled: {
    color: theme.palette.text.disabled,
  },

  minx: {
    lineHeight: '.90rem',
    fontSize: '.75rem',
  },
  line: {
    display: 'block',
  },
}));

function Megaminx({ scramble }) {
  const classes = useStyles();

  return scramble.split('\n').map((line) => (
    <span key={line} className={classes.line}>
      {line}
      {line.length === 41 ? <>&nbsp;</> : ''}
    </span>
  ));
}

function Scramble({
  event, scrambles, disabled,
}) {
  const classes = useStyles();

  return (
    <div className={clsx(classes.root, {
      [classes.disabled]: disabled,
    })}
    >
      <Typography
        variant="h6"
        className={clsx({
          [classes[event]]: true,
        }, classes.scramble)}
      >
        {scrambles.length ? scrambles.map((scramble) => (event === 'minx' ? <Megaminx key={scramble} scramble={scramble} /> : scramble)) : 'No Scrambles'}
      </Typography>
    </div>
  );
}

Scramble.propTypes = {
  event: PropTypes.string,
  scrambles: PropTypes.arrayOf(PropTypes.string),
  disabled: PropTypes.bool,
};

Scramble.defaultProps = {
  event: '333',
  scrambles: [],
  disabled: false,
};

export default Scramble;
