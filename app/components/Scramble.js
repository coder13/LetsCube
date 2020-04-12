import React from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';

const useStyles = makeStyles(() => ({
  root: {
    margin: '.5em',
    textAlign: 'center',
    '-webkit-user-select': 'text',
    '-webkit-touch-callout': 'text',
    '-moz-user-select': 'text',
    '-ms-user-select': 'text',
    'user-select': 'text',
  },
  scramble: {
    fontFamily: 'Roboto Mono, monospace',
    fontSize: '1.25em',
  },
  // eslint-disable-next-line quote-props
  minx: {
    lineHeight: '1.25em',
    fontSize: '1.25em',
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

function Scramble({ event, scrambles }) {
  const classes = useStyles();

  return (
    <div className={classes.root}>
      <Typography
        variant="subtitle2"
        className={clsx(classes.scramble, {
          [classes[event]]: true,
        })}
      >
        {scrambles.length ? scrambles.map((scramble) => (event === 'minx' ? <Megaminx scramble={scramble} /> : scramble)) : 'No Scrambles'}
      </Typography>
    </div>
  );
}

Scramble.propTypes = {
  event: PropTypes.string,
  scrambles: PropTypes.arrayOf(PropTypes.string),
};

Scramble.defaultProps = {
  event: '333',
  scrambles: [],
};

export default Scramble;
