import React, { createRef } from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import TableContainer from '@material-ui/core/TableContainer';
import Table from '@material-ui/core/Table';
import TableHead from '@material-ui/core/TableHead';
import TableBody from '@material-ui/core/TableBody';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import { formatTime } from '../../lib/utils';
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
    overflowY: 'auto',
    height: '0px',
  },
  tr: {
    display: 'table',
    tableLayout: 'fixed',
    width: '100%',
  },
  tableHeaderTime: {
    paddingLeft: 0,
  },
  tableResultCell: {
    paddingLeft: '2em',
  },
  tableHeaderMean: {
    paddingLeft: 16,
  },
  disabled: {
    color: '#7f7f7f',
  },
}));


function TableStatusCell({ status }) {
  const classes = useStyles();

  return (
    <TableCell className={classes.tableResultCell} align="left">
      <span>{status === 'RESTING' ? '' : status}</span>
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
    <TableCell className={classes.tableResultCell} align="left">
      <span
        style={{
          color: highlight ? 'red' : 'black',
        }}
      >
        {time === null ? '' : displayTime}
      </span>
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
    users, statuses, attempts, competing,
  }, stats,
}) {
  const classes = useStyles();
  const tableBodyRef = createRef();

  if (tableBodyRef.current) {
    // scrolls the times.
    tableBodyRef.current.scrollTop = 0;
  }

  // Converts true/false to 1/0 and then sorts by looking at the difference between the 2 values
  const sortedUsers = users.sort((userA, userB) => +competing[userB.id] - +competing[userA.id]);

  return (
    <TableContainer className={classes.root}>
      <Table stickyHeader className={classes.table} size="small">
        <TableHead className={classes.thead}>
          <TableRow className={classes.tr}>
            <TableCell align="left" className={classes.tableHeaderIndex}>#</TableCell>
            {sortedUsers.map((u) => (
              <TableCell
                key={u.id}
                align="left"
                className={clsx(classes.tableHeaderTime, {
                  [classes.disabled]: !competing[u.id],
                })}
              >
                <User user={u} />
                <br />
              </TableCell>
            ))}
          </TableRow>
          <TableRow className={classes.tr}>
            <TableCell align="left">mean</TableCell>
            {sortedUsers.map((u) => (
              <TableCell
                key={u.id}
                align="left"
                className={clsx(classes.tableHeaderMean, {
                  [classes.disabled]: !competing[u.id],
                })}
              >
                <span>
                  {stats[u.id] ? formatTime(stats[u.id].mean).toString() : ''}
                </span>
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
                <TableCell align="left">{attempts.length - index}</TableCell>
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
  }),
  stats: PropTypes.shape(),
};

TimesTable.defaultProps = {
  room: {
    users: [],
    statuses: {},
    attempts: [],
    competing: {},
  },
  stats: {},
};

export default TimesTable;
