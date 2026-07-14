import React from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import Paper from '@mui/material/Paper';
import Toolbar from '@mui/material/Toolbar';
import Divider from '@mui/material/Divider';
import { makeStyles } from '@mui/styles';

const useStyles = makeStyles(() => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
}));

function Panel({
  toolbar, children, className, ...props
}) {
  const classes = useStyles();

  return (
    <Paper {...props} className={clsx(classes.root, className)} variant="outlined" square>
      {toolbar}
      <Divider />
      {children}
    </Paper>
  );
}

Panel.propTypes = {
  toolbar: PropTypes.node,
  className: PropTypes.shape(),
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
};

Panel.defaultProps = {
  toolbar: (
    <Toolbar variant="dense">
      Default
    </Toolbar>
  ),
  className: '',
  children: [],
};

export default Panel;
