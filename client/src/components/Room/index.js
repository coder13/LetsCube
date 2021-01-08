import React, { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import { connect, useDispatch } from 'react-redux';
import Paper from '@material-ui/core/Paper';
import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import qs from 'qs';
import Login from './Common/Login';
import {
  fetchRoom,
  joinRoom,
} from '../../store/room/actions';
import Normal from './Normal';
import GrandPrix from './GrandPrix';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
    margin: 'auto',
    width: '100%',
    [theme.breakpoints.up('lg')]: {
      width: '83.333333%',
    },
  },
}));

const useQuery = () => qs.parse(useLocation().search, { ignoreQueryPrefix: true });

const Room = ({
  fetching, room, inRoom,
}) => {
  const classes = useStyles();
  const dispatch = useDispatch();
  const query = useQuery();
  const { roomId } = useParams();

  const { accessCode, _id } = room;

  useEffect(() => {
    if (!fetching && !_id) {
      dispatch(fetchRoom({
        id: roomId,
        password: query.password,
        spectating: query.spectating,
      }));
    }
  }, [dispatch, fetching, query.password, query.spectating, roomId, _id]);

  useEffect(() => {
    if (!fetching && accessCode) {
      dispatch(joinRoom({
        id: _id,
        password: query.password,
      }));
    }
  }, [dispatch, fetching, query.password, accessCode, _id]);

  const loggedIn = !room.private || inRoom;

  if (fetching) {
    return (
      <Backdrop open>
        <CircularProgress color="inherit" />
      </Backdrop>
    );
  }

  if (loggedIn) {
    if (room.type === 'grand_prix') {
      return <GrandPrix room={room} />;
    }

    return <Normal room={room} />;
  }

  return (
    <Paper className={classes.root}>
      <Login />
    </Paper>
  );
};

Room.propTypes = {
  fetching: PropTypes.bool,
  room: PropTypes.shape({
    _id: PropTypes.string,
    private: PropTypes.bool,
    accessCode: PropTypes.string,
    name: PropTypes.string,
    admin: PropTypes.shape(),
    type: PropTypes.oneOf(['normal', 'grand_prix']),
  }),
  user: PropTypes.shape({
    id: PropTypes.number,
  }),
  inRoom: PropTypes.bool,
};

Room.defaultProps = {
  fetching: true,
  room: {
    _id: undefined,
    private: false,
    accessCode: undefined,
    name: undefined,
    type: 'normal',
  },
  user: {
    id: undefined,
  },
  inRoom: false,
};

const mapStateToProps = (state) => ({
  fetching: state.room.fetching,
  room: state.room,
  inRoom: !!state.socket.room, // this tells us that we're actually in the room
  user: state.user,
});

export default connect(mapStateToProps)(Room);
