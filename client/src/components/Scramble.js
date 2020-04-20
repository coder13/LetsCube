import React from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';

const useStyles = makeStyles((theme) => ({
  root: {
    padding: '.5em',
    textAlign: 'center',
    '-webkit-user-select': 'text',
    '-webkit-touch-callout': 'text',
    '-moz-user-select': 'text',
    '-ms-user-select': 'text',
    'user-select': 'text',
    backgroundColor: theme.palette.grey[100],
    color: theme.palette.text.primary,
  },
  scramble: {
    fontFamily: 'Roboto Mono, monospace',
    fontSize: '1rem',
  },
  disabled: {
    color: '#7f7f7f',
  },
  // eslint-disable-next-line quote-props
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

  return scramble.split('\n').map((line, index) => (
    <span key={index.toString()} className={classes.line}>
      {line}
      {line.length === 41 ? <>&nbsp;</> : ''}
    </span>
  ));
}

function Scramble({ event, scrambles, disabled }) {
  const classes = useStyles();

  return (
    <div className={clsx(classes.root, {
      [classes.disabled]: disabled,
    })}
    >
      <Typography
        variant="subtitle2"
        className={clsx({
          [classes[event]]: true,
        }, classes.scramble)}
      >
        {scrambles.length ? scrambles.map((scramble) => (event === 'minx' ? <Megaminx scramble={scramble} /> : scramble)) : 'No Scrambles'}
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
