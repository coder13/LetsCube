import React from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { makeStyles } from '@mui/styles';
import Typography from '@mui/material/Typography';
import TableCell from '@mui/material/TableCell';

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
