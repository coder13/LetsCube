import React from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import TableCell from '@material-ui/core/TableCell';
import { formatTime } from '../../../lib/utils';
import { useEditDialog } from './EditDialogProvider';

const useStyles = makeStyles((theme) => ({
  root: {
  },
  highlight: {
    color: theme.palette.common.red,
  },
}));

function TableTimeCell({
  attemptId,
  solveNum,
  attempt: { time, penalties },
  highlight,
  isSelfUser,
  className,
}) {
  const classes = useStyles();
  const displayTime = formatTime(time, penalties);
  const showEditDialog = useEditDialog();

  const editTime = (id, solve, result) => {
    showEditDialog({
      id,
      solve,
      result,
    });
  };

  const timeText = (
    <Typography
      variant="subtitle2"
      className={clsx({
        [classes.highlight]: highlight,
      })}
    >
      {time === null ? '' : displayTime}
    </Typography>
  );

  return (
    <TableCell className={clsx(classes.root, className)}>
      {isSelfUser ? (
        <Button onClick={() => editTime(attemptId, solveNum, { time, penalties })}>
          {timeText}
        </Button>
      ) : timeText}
    </TableCell>
  );
}

TableTimeCell.propTypes = {
  attemptId: PropTypes.number,
  solveNum: PropTypes.number,
  attempt: PropTypes.shape({
    time: PropTypes.number,
    penalties: PropTypes.shape(),
  }),
  highlight: PropTypes.bool,
  isSelfUser: PropTypes.bool,
  className: PropTypes.string,
};

TableTimeCell.defaultProps = {
  attemptId: 0,
  solveNum: 1,
  attempt: {
    time: null,
    penalties: {},
  },
  highlight: false,
  isSelfUser: false,
  className: '',
};

export default TableTimeCell;
