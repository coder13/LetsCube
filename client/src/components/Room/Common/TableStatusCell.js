import React from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import TableCell from '@material-ui/core/TableCell';

const useStyles = makeStyles(() => ({
  root: {
  },
}));

function TableStatusCell({ status, className }) {
  const classes = useStyles();

  return (
    <TableCell className={clsx(classes.root, className)}>
      <Typography variant="subtitle1">{status === 'RESTING' ? '' : status}</Typography>
    </TableCell>
  );
}

TableStatusCell.propTypes = {
  status: PropTypes.string,
  className: PropTypes.string,
};

TableStatusCell.defaultProps = {
  status: '',
  className: '',
};

export default TableStatusCell;
