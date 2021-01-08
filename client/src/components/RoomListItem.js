import React from 'react';
import { useHistory } from 'react-router-dom';
import { connect, useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { formatDistanceToNow } from 'date-fns';
import Tooltip from '@material-ui/core/Tooltip';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import Typography from '@material-ui/core/Typography';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import IconButton from '@material-ui/core/IconButton';
import PublicIcon from '@material-ui/icons/Public';
import PrivateIcon from '@material-ui/icons/Lock';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import { useConfirm } from 'material-ui-confirm';
import lcFetch from '../lib/fetch';
// import ListItem from './ListItemLink';
import { getNameFromId } from '../lib/events';
import { deleteRoom } from '../store/room/actions';
import { updateProfile } from '../store/user/actions';

const canUserJoinRoom = (user, room) => {
  if (!!user.id && !user.canJoinRoom) {
    return [true, 'Must set a username or reveal WCA identity to join'];
  }

  if (room.requireRevealedIdentity && !user.showWCAID) {
    return [false, 'You must reveal identity to join room'];
  }

  return [false];
};

function RoomListItem({
  room, user,
}) {
  const dispatch = useDispatch();
  const confirm = useConfirm();
  const history = useHistory();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const anchorRef = React.useRef(null);
  const userText = room.usersLength === 0 ? ' empty'
    : ` ${room.usersLength} user${room.usersLength > 1 ? 's' : ''}${room.users ? `: ${room.users.join(', ')}` : ''}`;
  const [disabled, reason] = canUserJoinRoom(user, room);
  const [duration, setDuration] = React.useState(null);
  const [unixDuration, setUnixDuration] = React.useState(null);

  const canDelete = +user.id === 8184 || user.id === room.admin.id;

  React.useEffect(() => {
    const startTime = room.startTime ? new Date(room.startTime) : null;
    let timerObj = null;
    if (startTime) {
      timerObj = setInterval(() => {
        setDuration(formatDistanceToNow(startTime, { addSuffix: true, includeSeconds: true }));
        setUnixDuration((startTime.getTime() - Date.now()) / 1000);
      }, 1000);
      setDuration(formatDistanceToNow(startTime, { addSuffix: true, includeSeconds: true }));
      setUnixDuration((startTime.getTime() - Date.now()) / 1000);
    }

    return () => {
      clearInterval(timerObj);
    };
  }, [room]);

  const handleDeleteRoom = (event) => {
    event.preventDefault();
    confirm({ title: 'Are you sure you want to delete this room? ' })
      .then(() => {
        dispatch(deleteRoom(room._id));
      })
      .catch(() => {});
  };

  const handleJoinRoom = () => {
    if (!menuOpen) {
      if (room.requireRevealedIdentity && !user.showWCAID) {
        confirm({ title: 'You must reveal identity to join room. Are you sure you want to?' })
          .then(() => {
            lcFetch('/api/updatePreference', {
              headers: {
                'Content-Type': 'application/json',
              },
              method: 'PUT',
              body: JSON.stringify({
                showWCAID: true,
              }),
            }).then((res) => res.json()).then((res) => {
              dispatch(updateProfile({
                showWCAID: res.showWCAID,
                displayName: res.displayName,
                canJoinRoom: res.canJoinRoom,
              }));
              history.push(`/rooms/${room._id}`);
            });
          })
          .catch(() => {});
      } else {
        history.push(`/rooms/${room._id}`);
      }
    }
  };

  const handleSpectateRoom = () => {
    history.push(`/rooms/${room._id}?spectating=true`);
  };

  return (
    <ListItem
      button
      onClick={handleJoinRoom}
      disabled={disabled}
    >
      <ListItemIcon>
        { room.private
          ? <PrivateIcon />
          : <PublicIcon />}
      </ListItemIcon>
      <div
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <ListItemText
          primary={(
            <Typography variant="h6">
              {`${room.name} (${getNameFromId(room.event)})`}
            </Typography>
          )}
          secondary={(
            <Typography>
              {userText}
            </Typography>
          )}
        />
        { room.startTime && (
          <ListItemText
            secondary={(
              <Tooltip title={room.startTime}>
                <Typography variant="subtitle2" component="span">
                  {`${unixDuration < 0 ? 'Started' : 'Starts'} ${duration}`}
                </Typography>
              </Tooltip>
            )}
          />
        )}
        { reason && (
          <ListItemText
            secondary={reason}
          />
        )}
      </div>
      <Menu
        id={`${room._id}-menu`}
        anchorEl={anchorRef.current}
        keepMounted
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      >
        <MenuItem onClick={handleSpectateRoom}>Spectate</MenuItem>
        { canDelete && (
          <MenuItem onClick={handleDeleteRoom}>Delete</MenuItem>
        )}
      </Menu>
      <ListItemSecondaryAction>
        <IconButton edge="end" ref={anchorRef} onClick={() => setMenuOpen(true)}>
          <MoreVertIcon />
        </IconButton>
      </ListItemSecondaryAction>
    </ListItem>
  );
}

RoomListItem.propTypes = {
  room: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    event: PropTypes.string,
    private: PropTypes.bool,
    usersLength: PropTypes.number,
    users: PropTypes.array,
    startTime: PropTypes.string,
    requireRevealedIdentity: PropTypes.bool,
    admin: PropTypes.shape({
      id: PropTypes.number,
    }),
  }),
  user: PropTypes.shape({
    id: PropTypes.number,
    showWCAID: PropTypes.bool,
  }),
};

RoomListItem.defaultProps = {
  room: {
    _id: undefined,
    name: undefined,
    event: undefined,
    private: false,
    usersLength: 0,
    users: undefined,
    startTime: undefined,
    requireRevealedIdentity: false,
    admin: {
      id: undefined,
    },
  },
  user: {
    id: undefined,
    showWCAID: false,
  },
};

const mapStateToProps = (state) => ({
  user: state.user,
});

export default connect(mapStateToProps)(RoomListItem);
