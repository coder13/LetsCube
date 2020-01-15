import React, { useEffect } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
// import { AutoSizer, Column, Table } from 'react-virtualized';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import Divider from '@material-ui/core/Divider';
import TableContainer from '@material-ui/core/TableContainer';
import Table from '@material-ui/core/Table';
import TableHead from '@material-ui/core/TableHead';
import TableBody from '@material-ui/core/TableBody';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import { fetchRoom } from '../store/room/actions';
import Timer from './Timer';
import { formatTime } from '../lib/utils';

/*
  GET room
  if there is no password, POS to the room to join it and start listening with socketio
  if there is a password:
    Present login screen, upon submission, send a POST to the room with the password
    If we get an error, return to / with notifcation about not being able to join room
    If no error, start listening with socketio
*/

let lastRoomId = null;
const useStyles = makeStyles(theme => ({
  root: {
    flexGrow: 1,
  },
  paper: {
    padding: theme.spacing(0),
    color: theme.palette.text.secondary,
  },
  center: {
    textAlign: 'center',
  },
  tableContainer: {
    maxHeight: '250px',
  },
  table: {
    padding: 'none',
  },
  tableHeaderIndex: {
    width: '1em',
  },
  tableHeaderTime: {
    width: '12px',
    maxWidth: '12px',
  },
  noClick: {
    cursor: 'initial',
  },
}));

const scramble = `U' R L2 D2 L2 D' R2 U L2 F2 R2 U' B' U R2 U2 L' D R2 F'`;
// const users = [{
//   id: 8184,
//   name: 'Caleb Hoover',
//   username: 'Kleb',
//   wcaId: '2016HOOV01',
// }, {
//   id: 6969,
//   name: 'Anto Kam',
//   username: 'Rouxles',
//   wcaId: '2016HOOV01',
// }, {
//   id: 5690,
//   name: 'Stuart Clark',
//   username: 'Stewy',
//   wcaId: '2015CLAR14',
// }, {
//   id: 1234,
//   name: 'Louis de Mendonça',
//   username: 'TLDM',
//   wcaId: '2013MEND03',
// }]

// const attempts = [1,2,3,4,5].map(i => ({
//   scramble: `U' R L2 D2 L2 D' R2 U L2 F2 R2 U' B' U R2 U2 L' D R2 F'`,
//   results: [{
//     user: 8184,
//     time: Math.round(Math.random()*100000),
//     penalty: Math.random() > 0,
//     state: 'Submitted',
//   }, {
//     user: 6969,
//     time: Math.round(Math.random()*100000),
//     penalty: Math.random() > 0,
//     state: 'Submitted',
//   }, {
//     user: 5690,
//     time: Math.round(Math.random()*100000),
//     penalty: Math.random() > 0,
//     state: 'Submitted',
//   }, {
//     user: 1234,
//     time: Math.round(Math.random()*100000),
//     penalty: Math.random() > 0,
//     state: 'Submitted',
//   }]
// }));

const Room = (props) => {
  const classes = useStyles();
  const { dispatch, match } = props;
  const { users, attempts } = props;
  const { roomId } = match.params;

  useEffect(() => {
    if (roomId !== lastRoomId) {
      dispatch(fetchRoom(roomId))
      lastRoomId = roomId;
    }
  }, [dispatch, roomId]);

  const onStatusChange = () => {

  }

  const onSubmitTime = () => {

  }

  return (
    <div className={classes.root}>        
        <Grid container justify="center">
          <Grid item xs={12} sm={10} md={10} lg={10}>
            <Paper className={classes.paper}>
              <div className={classes.center}>
                <Typography variant="subtitle2">&nbsp;</Typography>
                <Typography variant="subtitle2">{scramble}</Typography>
                <Typography variant="subtitle2">&nbsp;</Typography>
                <Divider />
                <Timer
                  
                  onStatusChange={onStatusChange}
                  onSubmitTime={onSubmitTime}
                />
                <Divider />
              </div>

              <TableContainer className={classes.tableContainer}>
                <Table className={classes.table} size="small">
                  <TableHead>
                    <TableRow className={classes.tableRow}>
                      <TableCell align="left" className={classes.tableHeaderIndex}>#</TableCell>
                      {users.map((user, index) =>
                        <TableCell key={index} align="left" className={classes.tableHeaderTime}>
                          {user.username || user.name}
                        </TableCell>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {attempts.map((attempt,i) => (
                      <TableRow className={classes.tableRow} key={i}>
                        <TableCell className={classes.tableResultCell} align="left">{i + 1}</TableCell>
                        {users.map((user, j) =>
                          <TableCell key={j} className={classes.tableResultCell} align="left">
                            {formatTime(attempt.results.find(result => result.user === user.id).time)}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>

    </div>
  );
}

// function Login (props) {
//   return (
//     <Container>
//         <Paper></Paper>
//     </Container>
//   );
// }

const mapStateToProps = (state) => ({
  ...state.room
})

export default connect(mapStateToProps)(Room);