import React, { useEffect } from 'react';
import { useDispatch, connect } from 'react-redux';
import { makeStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import Paper from '@material-ui/core/Paper';
import Button from '@material-ui/core/Button';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Typography from '@material-ui/core/Typography';
import IconButton from '@material-ui/core/IconButton';
import FilterNoneIcon from '@material-ui/icons/FilterNone';
import { fetchAdminData } from '../../store/admin/actions';

const useStyles = makeStyles(() => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    height: 0,
  },
  roomContainer: {
    overflow: 'auto',
  },
  card: {
    marginTop: '1em',
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const renderUser = (user) => (user ? `${user.displayName} (${user.id})` : 'null');

  return (
    <Paper className={classes.root}>
      <Button
        variant="contained"
        color="primary"
        disableElevation
        onClick={() => dispatch(fetchAdminData())}
        className={classes.refetchButton}
      >
        Refetch Data
      </Button>
      <div className={classes.roomContainer}>
        {rooms.map((room) => (
          <Card key={room.id} className={classes.card}>
            <CardContent>
              <Typography variant="h4" component="h2">{room.name}</Typography>
              <Typography>
                {`id: ${room.id}`}
                <IconButton
                  size="small"
                  onClick={() => copyToClipboard(room.id)}
                >
                  <FilterNoneIcon />
                </IconButton>
              </Typography>
              <Typography>{`admin: ${renderUser(room.admin)}`}</Typography>
              <Typography>{`owner: ${renderUser(room.owner)}`}</Typography>
              <Typography>{`accessCode: ${room.accessCode}`}</Typography>
              <Typography>{`private: ${room.private}`}</Typography>
              {room.private && <Typography>{`password: ${room.password}`}</Typography>}
              <Typography>{`users: [${room.users.map(renderUser).join(', ')}]`}</Typography>
              <Typography variant="h5" component="h3">Users in Room: </Typography>
              <div style={{ padding: '1em' }}>
                {room.userSocketsInRoom.length > 0
                  ? room.userSocketsInRoom.map((user) => (
                    <Typography key={user.id}>{`${renderUser(user)}: [${user.sockets.join(', ')}]`}</Typography>
                  ))
                  : <Typography>None</Typography>}
              </div>
              <Typography>{`Expires at: ${room.expireAt}`}</Typography>
            </CardContent>
          </Card>
        ))}
      </div>
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
