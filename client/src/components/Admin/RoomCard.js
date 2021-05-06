import React, { useState, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { makeStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CardHeader from '@material-ui/core/CardHeader';
import Typography from '@material-ui/core/Typography';
import IconButton from '@material-ui/core/IconButton';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import { useConfirm } from 'material-ui-confirm';
import { deleteRoom } from '../../store/room/actions';
import { createMessage } from '../../store/messages/actions';

const Text = ({ children }) => (
  <span
    style={{
      WebkitUserSelect: 'text',
    }}
  >
    {children}
  </span>
);

Text.propTypes = {
  children: PropTypes.string,
};

Text.defaultProps = {
  children: '',
};

const useStyles = makeStyles(() => ({
  root: {
    marginTop: '1em',
  },
}));

function RoomCard({ room }) {
  const dispatch = useDispatch();
  const classes = useStyles();
  const confirm = useConfirm();
  const [menuOpen, setMenuOpen] = useState(false);
  const anchorRef = useRef(null);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const handleDeleteRoom = (event) => {
    event.preventDefault();
    confirm({ title: 'Are you sure you want to delete this room? ' })
      .then(() => {
        dispatch(deleteRoom(room.id));
      })
      .catch(() => {});
  };

  const renderUser = (user, i = 0) => (
    user ? (
      <>
        {i > 0 && ', '}
        <Text>{user.displayName}</Text>
        {' '}
        (
        <Text>{user.id}</Text>
        )
      </>
    ) : null
  );

  return (
    <Card key={room.id} className={classes.card}>
      <CardHeader
        action={(
          <IconButton ref={anchorRef} onClick={() => setMenuOpen(true)}>
            <MoreVertIcon />
          </IconButton>
        )}
        title={(
          <>
            <Text>{room.name}</Text>
            &nbsp;(
            <Text>{room.id}</Text>
            )
          </>
        )}
      />
      <CardContent>
        <Typography>
          admin:&nbsp;
          {renderUser(room.admin)}
        </Typography>
        <Typography>
          owner:&nbsp;
          {renderUser(room.owner)}
        </Typography>
        <Typography>
          accessCode:&nbsp;
          <Text>{room.accessCode}</Text>
        </Typography>
        <Typography>
          private:&nbsp;
          <Text>{room.private ? 'true' : 'false'}</Text>
        </Typography>
        {room.private && <Typography>{`password: ${room.password}`}</Typography>}
        <Typography>
          users:&nbsp;[
          {room.users.map(renderUser)}
          ]
        </Typography>
        <Typography variant="h5" component="h3">Users in Room: </Typography>
        <div style={{ padding: '1em' }}>
          {room.userSocketsInRoom.length > 0
            ? room.userSocketsInRoom.map((user) => (
              <Typography key={user.id}>
                {renderUser(user)}
                : [
                {user.sockets.map((socket, i) => (
                  <>
                    { i > 0 && ', '}
                    &quot;
                    <Text>{socket}</Text>
                    &quot;
                  </>
                ))}
                ]
              </Typography>
            ))
            : <Typography>None</Typography>}
        </div>
        <Typography>{`Expires at: ${room.expireAt}`}</Typography>
      </CardContent>
      <Menu
        id={`${room.id}-menu`}
        anchorEl={anchorRef.current}
        keepMounted
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      >
        <MenuItem onClick={() => {
          copyToClipboard(JSON.stringify(room));
          dispatch(createMessage({ text: 'JSON copied to clipboard' }));
        }}
        >
          Copy to JSON
        </MenuItem>
        <MenuItem onClick={handleDeleteRoom}>Delete</MenuItem>
      </Menu>
    </Card>
  );
}

RoomCard.propTypes = {
  room: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    accessCode: PropTypes.string,
    private: PropTypes.string,
    password: PropTypes.bool,
    owner: PropTypes.shape(),
    admin: PropTypes.shape(),
    users: PropTypes.arrayOf(PropTypes.shape()),
    userSocketsInRoom: PropTypes.arrayOf(PropTypes.shape()),
    expireAt: PropTypes.string,
  }),
};

RoomCard.defaultProps = {
  room: {
    id: undefined,
    users: [],
    accessCode: undefined,
    private: false,
    password: undefined,
    owner: {
      id: undefined,
      displayName: undefined,
    },
    admin: undefined,
    expireAt: null,
    userSocketsInRoom: [],
  },
};

export default RoomCard;
