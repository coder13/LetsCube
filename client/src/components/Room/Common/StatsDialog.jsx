import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@mui/styles';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import { formatTime } from '../../../lib/utils';

const useStyles = makeStyles(() => ({
  scramble: {
    '-webkit-user-select': 'contain',
    '-webkit-touch-callout': 'contain',
    '-moz-user-select': 'contain',
    '-ms-user-select': 'contain',
    'user-select': 'contain',
  },
}));

function StatsDialog({
  open,
  title,
  stats,
  onClose,
}) {
  const classes = useStyles();

  return (
    <Dialog fullWidth open={open} onClose={onClose}>
      {title && (
        <DialogTitle>{title}</DialogTitle>
      )}
      <DialogContent>
        {stats.map((stat) => (
          <Paper key={stat.scramble} elevation={0}>
            <Typography variant="h5" className={classes.scramble}>{stat.scramble}</Typography>
            {stat.results.filter((r) => !!r.result).map(({ name, result }) => (
              <div key={name}>
                <Typography component="span" variant="body1">
                  {name}
                  {': '}
                </Typography>
                <Typography component="span" variant="subtitle1">{formatTime(result.time, result.penalties)}</Typography>
              </div>
            ))}
          </Paper>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

StatsDialog.propTypes = {
  open: PropTypes.bool,
  title: PropTypes.string,
  stats: PropTypes.arrayOf(PropTypes.shape()),
  onClose: PropTypes.func,
};

StatsDialog.defaultProps = {
  title: '',
  stats: [],
  open: false,
  onClose: () => {},
};

export default StatsDialog;
