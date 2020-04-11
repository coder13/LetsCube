import React, { createRef } from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import TableContainer from '@material-ui/core/TableContainer';
import Table from '@material-ui/core/Table';
import TableHead from '@material-ui/core/TableHead';
import TableBody from '@material-ui/core/TableBody';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import { formatTime } from '../../lib/utils';

const useStyles = makeStyles((theme) => ({
  tableHeaderIndex: {
    width: '1em',
  },
  tableHeaderTime: {
    width: '1em',
  },
  tableResultCell: {
    width: '1em',
  },
  root: {
    flexGrow: 1,
    display: 'flex',
    overflowY: 'auto',
  },
  table: {
    padding: 'none',
    display: 'flex',
    flexFlow: 'column',
  },
  thead: {
    display: 'table',
    tableLayout: 'fixed',
    flex: '0 0 auto',
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
}));

function TimesTable({ users, attempts }) {
  const classes = useStyles();
  const tableBodyRef = createRef();

  if (tableBodyRef.current) {
    // scrolls the times.
    tableBodyRef.current.scrollTop = 0;
  }

  const latestAttempt = (attempts && attempts.length) ? attempts[attempts.length - 1] : {};

  const sum = (a, b) => a + b;
  const mapToTime = (userId) => (i) => (i.results[userId]
    && !(i.results[userId].penalties && i.results[userId].penalties.DNF)
    ? i.results[userId].time : -1);

  const ao5 = (userId) => {
    if (!attempts || !attempts.length) {
      return undefined;
    }

    const last5 = (latestAttempt.results[userId]
      ? attempts.slice(-5) : attempts.slice(-6, -1)).map(mapToTime(userId));

    if (last5.length < 5) {
      return 0;
    } if (last5.indexOf(-1) > -1) {
      last5.splice(last5.indexOf(-1), 1);
      if (last5.indexOf(-1) > -1) {
        return -1; // DNF avg
      }

      return (last5.reduce(sum) - Math.min(...last5)) / 3;
    }

    return (last5.reduce(sum) - Math.min(...last5) - Math.max(...last5)) / 3;
  };

  return (
    <TableContainer className={classes.root}>
      <Table stickyHeader className={classes.table} size="small">
        <TableHead className={classes.thead}>
          <TableRow className={classes.tr}>
            <TableCell align="left" className={classes.tableHeaderIndex}>#</TableCell>
            {users.map((u) => (
              <TableCell key={u.id} align="left" className={classes.tableHeaderTime}>
                <span>{u.displayName}</span>
                <br />
              </TableCell>
            ))}
          </TableRow>
          <TableRow className={classes.tr} key={-1}>
            <TableCell className={classes.tableResultCell} align="left">ao5</TableCell>
            {users.map((u) => (
              <TableCell key={u.id} className={classes.tableResultCell} align="left">
                <span>{formatTime(ao5(u.id)).toString()}</span>
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
                <TableCell className={classes.tableResultCell} align="left">{attempts.length - index}</TableCell>
                {users.map((u) => (
                  <TableCell key={u.id} className={classes.tableResultCell} align="left">
                    {attempt.results[u.id]
                      ? (
                        <span style={{
                          color: attempt.results[u.id].time === best ? 'red' : 'black',
                        }}
                        >
                          {formatTime(
                            attempt.results[u.id].time,
                            attempt.results[u.id].penalties,
                          )}
                        </span>
                      ) : ''}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

TimesTable.propTypes = {
  users: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number,
  })),
  attempts: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number,
  })),
};

TimesTable.defaultProps = {
  users: [],
  attempts: [],
};


export default TimesTable;
