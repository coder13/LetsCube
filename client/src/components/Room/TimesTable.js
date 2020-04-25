import React, { createRef } from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import TableContainer from '@material-ui/core/TableContainer';
import Table from '@material-ui/core/Table';
import TableHead from '@material-ui/core/TableHead';
import TableBody from '@material-ui/core/TableBody';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import { formatTime } from '../../lib/utils';
import { useStatsDialog } from './StatsDialogProvider';
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

function TableTimeCell({ attempt: { time, penalties }, highlight }) {
  const classes = useStyles();

  const displayTime = formatTime(time, penalties);

  return (
    <TableCell className={clsx(classes.td, classes.tableResultCell)}>
      <Typography
        variant="subtitle2"
        className={clsx({
          [classes.highlight]: highlight,
        })}
      >
        {time === null ? '' : displayTime}
      </Typography>
    </TableCell>
  );
}

TableTimeCell.propTypes = {
  attempt: PropTypes.shape({
    time: PropTypes.number,
    penalties: PropTypes.shape(),
  }),
  highlight: PropTypes.bool,
};

TableTimeCell.defaultProps = {
  attempt: {
    time: null,
    penalties: {},
  },
  highlight: false,
};

function TimesTable({
  room: {
    users, statuses, attempts, competing, admin,
  }, stats,
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
              <TableCell
                key={u.id}
                className={clsx(classes.td, classes.tableHeaderMean, {
                  [classes.disabled]: !competing[u.id],
                })}
              >
                <Typography variant="subtitle2">
                  {stats[u.id] ? formatTime(stats[u.id].mean).toString() : ''}
                </Typography>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody className={classes.tbody} ref={tableBodyRef}>
          {[...attempts].reverse().map((attempt, index) => {
            const results = users
              .map((u) => (attempt.results[u.id]
                && (attempt.results[u.id].penalties
                  && !attempt.results[u.id].penalties.DNF)
                ? attempt.results[u.id].time : undefined))
              .filter((r) => !!r && r > -1);
            const best = Math.min(...results);

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
                    attempt={attempt.results[u.id]}
                    highlight={attempt.results[u.id] && attempt.results[u.id].time === best}
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
};

export default TimesTable;
