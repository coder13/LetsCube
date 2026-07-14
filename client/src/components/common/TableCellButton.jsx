import React from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { makeStyles } from '@mui/styles';
import TableCell from '@mui/material/TableCell';
import Button from '@mui/material/Button';

const useStyles = makeStyles(() => ({
  root: {

  },
  button: {
    padding: 0,
    width: 'inherit',
    height: 'inherit',
    minWidth: 0,
  },
}));

function TableCellButton({
  align, children, className, onClick, buttonProps, ...other
}) {
  const classes = useStyles();

  return (
    <TableCell
      align={align}
      className={clsx(classes.root, className)}

      {...other}
    >
      <Button
        onClick={onClick}
        className={classes.button}

        {...buttonProps}
      >
        { children }
      </Button>
    </TableCell>
  );
}

TableCellButton.propTypes = {
  align: PropTypes.string,
  children: PropTypes.shape(),
  className: PropTypes.string,
  buttonProps: PropTypes.shape(),
  onClick: PropTypes.func,
};

TableCellButton.defaultProps = {
  align: 'left',
  children: {},
  className: '',
  buttonProps: {},
  onClick: () => {},
};

export default TableCellButton;
