import React from 'react';
import { useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { formatDistanceToNow } from 'date-fns';
import Tooltip from '@material-ui/core/Tooltip';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import Typography from '@material-ui/core/Typography';
import IconButton from '@material-ui/core/IconButton';
import PublicIcon from '@material-ui/icons/Public';
import PrivateIcon from '@material-ui/icons/Lock';
import DeleteIcon from '@material-ui/icons/Delete';
import { useConfirm } from 'material-ui-confirm';
import ListItemLink from './ListItemLink';
import { getNameFromId } from '../lib/events';
import { deleteRoom } from '../store/room/actions';

function RoomListItem({ room, canDelete, canUserJoinRoom }) {
  const dispatch = useDispatch();
  const confirm = useConfirm();
  const userText = room.usersLength === 0 ? ' empty'
    : ` ${room.usersLength} user${room.usersLength > 1 ? 's' : ''}${room.users ? `: ${room.users.join(', ')}` : ''}`;
  const [disabled, reason] = canUserJoinRoom();
  const [duration, setDuration] = React.useState(null);
  const [unixDuration, setUnixDuration] = React.useState(null);

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

  const handleDeleteRoom = () => {
    confirm({ title: 'Are you sure you want to delete this room? ' })
      .then(() => {
        dispatch(deleteRoom(room._id));
      });
  };

  return (
    <ListItemLink
      to={`/rooms/${room._id}`}
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
                <Typography variant="subtitle2">
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
      { canDelete && (
        <ListItemSecondaryAction>
          <IconButton edge="end" aria-label="delete" onClick={handleDeleteRoom}>
            <DeleteIcon />
          </IconButton>
        </ListItemSecondaryAction>
      )}
    </ListItemLink>
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
  }),
  canDelete: PropTypes.bool,
  canUserJoinRoom: PropTypes.func,
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
  },
  canDelete: false,
  canUserJoinRoom: () => ([false, undefined]),
};

export default RoomListItem;
