import React, { useEffect } from 'react';
import { useDispatch, connect } from 'react-redux';
import { makeStyles } from '@mui/styles';
import PropTypes from 'prop-types';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import { fetchAdminData } from '../../store/admin/actions';
import RoomCard from './RoomCard';

const useStyles = makeStyles(() => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    height: 0,
  },
  roomContainer: {
    overflow: 'auto',
    padding: '1em',
    width: '50%',
  },
  refetchButton: {
    margin: '1em',
  },
}));

function Admin({ rooms }) {
  const dispatch = useDispatch();
  const classes = useStyles();

  useEffect(() => {
    dispatch(fetchAdminData());
  }, [dispatch]);

  return (
    <Paper className={classes.root}>
      <Container className={classes.roomContainer}>
        <Button
          variant="contained"
          color="primary"
          disableElevation
          onClick={() => dispatch(fetchAdminData())}
          className={classes.refetchButton}
        >
          Refetch Data
        </Button>
      </Container>
      <Container className={classes.roomContainer}>
        {rooms.length > 0 ? rooms.map((room) => (
          <RoomCard key={room.id} room={room} />
        )) : 'No rooms'}
      </Container>
    </Paper>
  );
}

Admin.propTypes = {
  rooms: PropTypes.arrayOf(PropTypes.shape()),
};

Admin.defaultProps = {
  rooms: {},
};

const mapStateToProps = (state) => ({
  rooms: state.admin.rooms,
});

export default connect(mapStateToProps)(Admin);
