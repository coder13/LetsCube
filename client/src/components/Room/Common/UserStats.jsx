import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Table from '@material-ui/core/Table';
import TableHead from '@material-ui/core/TableHead';
import TableBody from '@material-ui/core/TableBody';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import { formatTime } from '../../../lib/utils';

const useStyles = makeStyles((theme) => ({
  root: {
    padding: 0,
    marging: 0,
  },
  td: {
    backgroundColor: theme.palette.common.blue,
    borderBottomColor: theme.palette.common.blueBorder,
    color: theme.palette.text.primary,
  },
}));

function UserStats({ stats }) {
  const classes = useStyles();

  if (!stats) {
    return '';
  }

  const keys = Object.keys(stats.current).filter((key) => !!stats.current[key]);

  return (
    <Paper
      className={classes.root}
      square
      elevation={4}
    >
      <Table
        size="small"
      >
        <TableHead>
          <TableRow>
            <TableCell className={classes.td} />
            {keys.map((key) => (
              <TableCell key={key} className={classes.td}>{key}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell className={classes.td}>Current</TableCell>
            {keys.map((key) => (
              <TableCell key={key} className={classes.td}>
                {formatTime(stats.current[key])}
              </TableCell>
            ))}
          </TableRow>
          <TableRow>
            <TableCell className={classes.td}>Best</TableCell>
            {keys.map((key) => (
              <TableCell key={key} className={classes.td}>
                {formatTime(stats.best[key])}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </Paper>
  );
}

UserStats.propTypes = {
  stats: PropTypes.shape(),
};

UserStats.defaultProps = {
  stats: {
    current: {},
    best: {},
  },
};

export default UserStats;
