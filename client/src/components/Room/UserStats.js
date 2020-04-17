import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Table from '@material-ui/core/Table';
import TableHead from '@material-ui/core/TableHead';
import TableBody from '@material-ui/core/TableBody';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import { formatTime } from '../../lib/utils';

const useStyles = makeStyles(() => ({
  root: {
  },
}));

function UserStats({ stats }) {
  const classes = useStyles();
  const keys = Object.keys(stats).filter((key) => !!stats[key]);

  if (!keys || keys.length === 0) {
    return '';
  }

  return (
    <Table
      className={classes.root}
      size="small"
      component={Paper}
      elevation={4}
      square
    >
      <TableHead>
        <TableRow>
          {keys.map((key) => (
            <TableCell key={key}>{key}</TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        <TableRow>
          {keys.map((key) => (
            <TableCell key={key}>{formatTime(stats[key])}</TableCell>
          ))}
        </TableRow>
      </TableBody>
    </Table>
  );
}

UserStats.propTypes = {
  stats: PropTypes.shape(),
};

UserStats.defaultProps = {
  stats: {},
};

export default UserStats;
