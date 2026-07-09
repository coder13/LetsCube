import React from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import TableCell from '@material-ui/core/TableCell';
import Button from '@material-ui/core/Button';

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
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...other}
    >
      <Button
        onClick={onClick}
        className={classes.button}
        // eslint-disable-next-line react/jsx-props-no-spreading
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
