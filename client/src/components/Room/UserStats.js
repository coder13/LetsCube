import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Table from '@material-ui/core/Table';
import TableHead from '@material-ui/core/TableHead';
import TableBody from '@material-ui/core/TableBody';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import blue from '@material-ui/core/colors/blue';
import { formatTime } from '../../lib/utils';

const useStyles = makeStyles((theme) => ({
  root: {
    padding: 0,
    marging: 0,
  },
  td: {
    backgroundColor: blue[200],
    borderBottomColor: blue[300],
    color: theme.palette.text.primary,
  },
}));

function UserStats({ stats }) {
  const classes = useStyles();
  const keys = Object.keys(stats).filter((key) => !!stats[key]);

  if (!keys || keys.length === 0) {
    return '';
  }

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
            {keys.map((key) => (
              <TableCell key={key} className={classes.td}>{key}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            {keys.map((key) => (
              <TableCell key={key} className={classes.td}>{formatTime(stats[key])}</TableCell>
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
  stats: {},
};

export default UserStats;
