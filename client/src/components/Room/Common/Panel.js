import React from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import Paper from '@material-ui/core/Paper';
import Toolbar from '@material-ui/core/Toolbar';
import Divider from '@material-ui/core/Divider';
import { makeStyles } from '@material-ui/core/styles';

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
  console.log(22, className);

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
