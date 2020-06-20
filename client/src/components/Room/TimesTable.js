import React, { createRef } from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import TableContainer from '@material-ui/core/TableContainer';
import Table from '@material-ui/core/Table';
import TableHead from '@material-ui/core/TableHead';
import TableBody from '@material-ui/core/TableBody';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import { formatTime } from '../../lib/utils';
import { useStatsDialog } from './StatsDialogProvider';
import { useEditDialog } from './EditDialogProvider';
import TableCellButton from '../TableCellButton';
import User from '../User';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    display: 'flex',
    overflowY: 'auto',
  },
  table: {
    display: 'flex',
    flexFlow: 'column',
  },
  thead: {
    boxShadow: theme.shadows[1],
  },
  tbody: {
    flexGrow: 1,
    height: '0px',
    '&:scollbar': {
      width: 200,
    },
  },
  tr: {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
  },
  td: {
    padding: '.25em',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableHeaderIndex: {
    width: '3rem',
    flexShrink: 0,
    height: '1.7rem',
    backgroundColor: theme.palette.common.green,
    borderBottomColor: theme.palette.common.greenBorder,
    color: theme.palette.text.primary,
  },
  tableHeaderTime: {
    width: '5rem',
    height: '1.7rem',
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: '6em',
    backgroundColor: theme.palette.background.default,
    borderBottomColor: theme.palette.divider,
    color: theme.palette.text.primary,
  },
  tableHeaderName: {
    height: '3rem',
  },
  tableResultCell: {
    width: '5rem',
    height: '1.7rem',
    flexGrow: 1,
  },
  tableHeaderMean: {
    width: '5rem',
    height: '1.7rem',
    flexGrow: 1,
    backgroundColor: theme.palette.background.default,
    borderBottomColor: theme.palette.divider,
    color: theme.palette.text.primary,
  },
  disabled: {
    color: theme.palette.text.disabled,
  },
  highlight: {
    color: theme.palette.common.red,
  },
}));

function TableStatusCell({ status }) {
  const classes = useStyles();

  return (
    <TableCell className={clsx(classes.td, classes.tableResultCell)}>
      <Typography variant="subtitle1">{status === 'RESTING' ? '' : status}</Typography>
    </TableCell>
  );
}

TableStatusCell.propTypes = {
  status: PropTypes.string,
};

TableStatusCell.defaultProps = {
  status: '',
};

function TableTimeCell({
  attemptId,
  solveNum,
  attempt: { time, penalties },
  highlight,
  isSelfUser,
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
    <TableCell className={clsx(classes.td, classes.tableResultCell)}>
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
};

function TimesTable({
  room: {
    users, statuses, attempts, competing, admin,
  }, stats, userId,
}) {
  const classes = useStyles();
  const tableBodyRef = createRef();
  const showStatsDialog = useStatsDialog();

  if (tableBodyRef.current) {
    // scrolls the times.
    tableBodyRef.current.scrollTop = 0;
  }

  // Converts true/false to 1/0 and then sorts by looking at the difference between the 2 values
  const sortedUsers = users.sort((userA, userB) => +competing[userB.id] - +competing[userA.id]);

  const showScramble = (attempt) => {
    showStatsDialog({
      title: `Solve ${attempt.id + 1}`,
      stats: [{
        scramble: attempt.scrambles[0],
        results: users.map((user) => ({
          name: user.displayName,
          result: attempt.results[user.id],
        })).sort((a, b) => a.time - b.time),
      }],
    });
  };

  const bestMean = Math.min(...sortedUsers
    .map((u) => stats[u.id] && stats[u.id].mean).filter((i) => i >= 0));

  return (
    <TableContainer className={classes.root}>
      <Table stickyHeader className={classes.table} size="small">
        <TableHead className={classes.thead}>
          <TableRow className={classes.tr}>
            <TableCell className={clsx(classes.td, classes.tableHeaderIndex,
              classes.tableHeaderName)}
            >
              <Typography variant="subtitle2">#</Typography>
            </TableCell>
            {sortedUsers.map((u) => (
              <TableCell
                key={u.id}
                className={clsx(classes.td, classes.tableHeaderTime,
                  classes.tableHeaderName)}
              >
                <User user={u} admin={admin.id === u.id} />
                <br />
              </TableCell>
            ))}
          </TableRow>

          <TableRow className={classes.tr}>
            <TableCell className={clsx(classes.td, classes.tableHeaderIndex)}>
              <Typography variant="subtitle2">mean</Typography>
            </TableCell>
            {sortedUsers.map((u) => (
              <TableTimeCell
                key={u.id}
                attempt={{
                  time: stats[u.id] ? stats[u.id].mean : 0,
                }}
                highlight={stats[u.id] && bestMean === stats[u.id].mean}
              />
            ))}
          </TableRow>

          <TableRow className={classes.tr}>
            <TableCell className={clsx(classes.td, classes.tableHeaderIndex)}>
              <Typography variant="subtitle2">wins</Typography>
            </TableCell>
            {sortedUsers.map((u) => (
              <TableCell
                key={u.id}
                className={clsx(classes.td, classes.tableHeaderTime)}
              >
                {stats[u.id] ? stats[u.id].wins : 0}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody className={classes.tbody} ref={tableBodyRef}>
          {[...attempts].reverse().map((attempt, index) => {
            const reversedI = attempts.length - index - 1;

            return (
              <TableRow className={classes.tr} key={attempt.id}>
                <TableCellButton
                  className={clsx(classes.td, classes.tableHeaderIndex)}
                  onClick={() => showScramble(attempt)}
                >
                  <Typography variant="subtitle2">{attempts.length - index}</Typography>
                </TableCellButton>
                {sortedUsers.map((u) => (index === 0 && !attempt.results[u.id] ? (
                  <TableStatusCell key={u.id} status={statuses[u.id]} />
                ) : (
                  <TableTimeCell
                    key={u.id}
                    attemptId={attempt.id}
                    solveNum={attempts.length - index}
                    attempt={attempt.results[u.id]}
                    highlight={attempt.results[u.id]
                      && Math.round(attempt.results[u.id].time)
                        === Math.round(stats.bests[reversedI])}
                    isSelfUser={u.id === userId}
                  />
                )))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

TimesTable.propTypes = {
  room: PropTypes.shape({
    users: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.number,
    })),
    statuses: PropTypes.shape(),
    attempts: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.number,
    })),
    competing: PropTypes.shape(),
    admin: PropTypes.shape(),
  }),
  stats: PropTypes.shape(),
  userId: PropTypes.number,
};

TimesTable.defaultProps = {
  room: {
    users: [],
    statuses: {},
    attempts: [],
    competing: {},
    admin: {},
  },
  stats: {},
  userId: 0,
};

export default TimesTable;
