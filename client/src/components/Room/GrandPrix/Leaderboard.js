import React from 'react';
import PropTypes from 'prop-types';
import { connect, useDispatch } from 'react-redux';
import { makeStyles } from '@material-ui/core/styles';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import Paper from '@material-ui/core/Paper';
import TableContainer from '@material-ui/core/TableContainer';
import Table from '@material-ui/core/Table';
import TableHead from '@material-ui/core/TableHead';
import TableBody from '@material-ui/core/TableBody';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import TableStatusCell from '../Common/TableStatusCell';
import TableTimeCell from '../Common/TableTimeCell';
import { StatsDialogProvider } from '../Common/StatsDialogProvider';
import { EditDialogProvider } from '../Common/EditDialogProvider';
import User from '../../User';

const useStyles = makeStyles(() => ({
  root: {
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
    height: '100%',
  },
  table: {
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
    overflowY: 'auto',
    height: 0,
    padding: 0,
  },
  user: {
    alignItems: 'baseline',
  },
}));

function Leaderboard({ room, user }) {
  const classes = useStyles();
  const dispatch = useDispatch();

  const sortedPoints = Object.keys(room.points).map((key) => ({
    id: key,
    points: room.points[key],
  })).sort((a, b) => b.points - a.points);

  const currentAttemptIndex = room.attempts.length - 1;
  const currentAttempt = room.attempts[currentAttemptIndex];
  const currentResults = currentAttempt ? currentAttempt.results : [];
  const best = Object.keys(currentResults).map((userId) => (
    (!currentResults[userId]
      || (currentResults[userId].penalties
      && currentResults[userId].penalties.DNF))
      ? -1 : currentResults[userId].time))
    .filter((time) => time > 0)
    .sort()[0];

  const { statuses } = room;

  return (
    <Paper className={classes.root} variant="outlined" square>
      <Toolbar
        className={classes.titlebar}
        variant="dense"
      >
        <Typography variant="h6" className={classes.title}>
          Leaderboard
        </Typography>
      </Toolbar>
      <StatsDialogProvider>
        <EditDialogProvider dispatch={dispatch}>
          <TableContainer className={classes.table}>
            <Table
              stickyHeader
            >
              <TableHead>
                <TableRow>
                  <TableCell>Competitor</TableCell>
                  <TableCell>Points</TableCell>
                  <TableCell>Current Round</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedPoints.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <>
                        <User
                          className={classes.user}
                          user={room.users.find((i) => +i.id === +u.id)}
                        />
                      </>
                    </TableCell>
                    <TableCell>{u.points}</TableCell>

                    {!currentResults[u.id]
                      ? <TableStatusCell key={u.id} status={statuses[u.id]} />
                      : (
                        <TableTimeCell
                          attemptId={currentAttempt.id}
                          solveNum={room.attempts.length}
                          attempt={currentAttempt.results[u.id]}
                          highlight={currentAttempt.results[u.id]
                          && Math.round(currentAttempt.results[u.id].time) === Math.round(best)}
                          isSelfUser={+u.id === +user.id}
                        />
                      )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </EditDialogProvider>
      </StatsDialogProvider>
    </Paper>
  );
}

Leaderboard.propTypes = {
  room: PropTypes.shape({
    users: PropTypes.arrayOf(PropTypes.shape()),
    points: PropTypes.shape(),
    statuses: PropTypes.shape(),
    attempts: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.number,
      results: PropTypes.shape(),
    })),
  }),
  user: PropTypes.shape({
    id: PropTypes.number,
  }),
};

Leaderboard.defaultProps = {
  room: {
    users: [],
    points: {},
    statuses: {},
    attempts: [],
  },
  user: {
    id: undefined,
  },
};

const mapStateToProps = (state) => ({
  room: state.room,
  user: state.user,
});

export default connect(mapStateToProps)(Leaderboard);
