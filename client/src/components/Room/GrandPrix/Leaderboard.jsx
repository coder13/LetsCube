import React from 'react';
import PropTypes from 'prop-types';
import { connect, useDispatch } from 'react-redux';
import { makeStyles } from '@mui/styles';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import TableContainer from '@mui/material/TableContainer';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableStatusCell from '../Common/TableStatusCell';
import TableTimeCell from '../Common/TableTimeCell';
import { StatsDialogProvider } from '../Common/StatsDialogProvider';
import { EditDialogProvider } from '../Common/EditDialogProvider';
import User from '../../User';
import { getLeaderboard } from '../../../store/room/selectors';

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

function Leaderboard({ room }) {
  const classes = useStyles();
  const dispatch = useDispatch();
  const points = getLeaderboard(room);

  const getPoints = (userId) => points[userId] || 0;
  const sortedUsers = room.users
    .filter((i) => room.registered[i.id])
    .map((u) => ({
      ...u,
      points: getPoints(u.id),
    }))
    .sort((a, b) => b.points - a.points);

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
              className="leaderboard-table"
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
                {sortedUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <>
                        <User
                          className={classes.user}
                          user={room.users.find((i) => +i.id === +u.id) || {}}
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
    requireRevealedIdentity: PropTypes.bool,
    registered: PropTypes.shape(),
  }),
  user: PropTypes.shape({
    id: PropTypes.number,
    showWCAID: PropTypes.bool,
  }),
};

Leaderboard.defaultProps = {
  room: {
    users: [],
    points: {},
    statuses: {},
    attempts: [],
    requireRevealedIdentity: false,
    registered: false,
  },
  user: {
    id: undefined,
    showWCAID: undefined,
  },
};

const mapStateToProps = (state) => ({
  room: state.room,
  user: state.user,
});

export default connect(mapStateToProps)(Leaderboard);
