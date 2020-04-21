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
  },
  scramble: {
    fontFamily: 'Roboto Mono, monospace',
    fontSize: '1rem',
  },
  disabled: {
    color: theme.palette.text.disabled,
  },
  // eslint-disable-next-line quote-props
  minx: {
    lineHeight: '.90rem',
    fontSize: '.75rem',
  },
  line: {
    display: 'block',
  },
  hidden: {
    color: '#00000000',
    transition: 'color .4s',
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

function Scramble({
  event, scrambles, disabled, hidden,
}) {
  const classes = useStyles();

  return (
    <div className={clsx(classes.root, {
      [classes.disabled]: disabled,
      [classes.hidden]: hidden,
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
  hidden: PropTypes.bool,
};

Scramble.defaultProps = {
  event: '333',
  scrambles: [],
  disabled: false,
  hidden: false,
};

export default Scramble;
