import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@mui/styles';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
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
