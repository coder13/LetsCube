import React from 'react';
import { useHistory } from 'react-router-dom';
import { connect, useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { formatDistanceToNow } from 'date-fns';
import Tooltip from '@material-ui/core/Tooltip';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import Card from '@material-ui/core/Card';
import CardHeader from '@material-ui/core/CardHeader';
import CardContent from '@material-ui/core/CardContent';
import CardActions from '@material-ui/core/CardActions';
import CardMedia from '@material-ui/core/CardMedia';
import Alert from '@material-ui/lab/Alert';
import Typography from '@material-ui/core/Typography';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import IconButton from '@material-ui/core/IconButton';
import Button from '@material-ui/core/Button';
import PublicIcon from '@material-ui/icons/Public';
import PrivateIcon from '@material-ui/icons/Lock';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import ShareIcon from '@material-ui/icons/Share';
import { useConfirm } from 'material-ui-confirm';
import { TwitchEmbed } from 'react-twitch-embed';
import { lcFetch } from '../../lib/fetch';
import { getNameFromId } from '../../lib/events';
import { createMessage } from '../../store/messages/actions';
import { deleteRoom } from '../../store/room/actions';
import { updateProfile } from '../../store/user/actions';

const useStyles = makeStyles((theme) => ({
  root: {
    marginBottom: theme.spacing(1),
  },
}));

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
  const classes = useStyles();
  const theme = useTheme();
  const dispatch = useDispatch();
  const confirm = useConfirm();
  const history = useHistory();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const anchorRef = React.useRef(null);
  const registeredUsersText = room.registeredUsers === 0 ? 'No registered users'
    : ` ${room.registeredUsers} registered user${room.registeredUsers > 1 ? 's' : ''}`;
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

  const copyLinkText = () => {
    navigator.clipboard.writeText(`${window.location.href}rooms/${room._id}`);
    dispatch(createMessage({
      severity: 'success',
      text: 'Link copied',
    }));
  };

  const handleSpectateRoom = () => {
    history.push(`/rooms/${room._id}?spectating=true`);
  };

  return (
    <Card
      disabled={disabled}
      className={classes.root}
    >
      <CardHeader
        avatar={room.private ? <PrivateIcon /> : <PublicIcon />}
        title={(
          <Typography variant="h6">
            {`${room.name} (${getNameFromId(room.event)})`}
          </Typography>
        )}
        subheader={room.startTime && (
          <Typography>
            <Tooltip title={room.startTime}>
              <Typography variant="subtitle2" component="span">
                {`${unixDuration < 0 ? 'Started' : 'Starts'} ${duration}`}
              </Typography>
            </Tooltip>
          </Typography>
        )}
        action={(
          <IconButton edge="end" ref={anchorRef} onClick={() => setMenuOpen(true)}>
            <MoreVertIcon />
          </IconButton>
        )}
      />
      { (room.twitchChannel && new Date(room.startTime) < new Date()) && (
        <CardMedia
          className={classes.media}
        >
          <TwitchEmbed
            channel={room.twitchChannel}
            id={`channel-${room.twitchChannel}-${room._id}`}
            muted
            withChat={false}
            theme={theme.palette.type}
            width="100%"
          />
        </CardMedia>
      )}
      <CardContent>
        <Typography gutterBottom>
          {registeredUsersText}
        </Typography>
        { new Date(room.startTime) > new Date() && (
          <Typography gutterBottom>
            Join to register!
          </Typography>
        )}
      </CardContent>
      {reason && <Alert>{reason}</Alert>}
      <CardActions disableSpacing>
        <Button aria-label="join event" onClick={handleJoinRoom}>
          JOIN
        </Button>
        <IconButton aria-label="share" onClick={copyLinkText}>
          <ShareIcon />
        </IconButton>
      </CardActions>
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
    </Card>
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
    registeredUsers: PropTypes.number,
    admin: PropTypes.shape({
      id: PropTypes.number,
    }),
    twitchChannel: PropTypes.string,
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
    registeredUsers: 0,
    twitchChannel: undefined,
  },
  user: {
    showWCAID: false,
  },
};

const mapStateToProps = (state) => ({
  user: state.user,
});

export default connect(mapStateToProps)(RoomListItem);
