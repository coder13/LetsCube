import React, { useState } from 'react';
import { connect } from 'react-redux';
import { Link as ReactRouterLink } from 'react-router-dom';
import PropTypes from 'prop-types';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import Link from '@material-ui/core/Link';
import Popover from '@material-ui/core/Popover';
import Tooltip from '@material-ui/core/Tooltip';
import IconButton from '@material-ui/core/IconButton';
import EmojiObjectsIcon from '@material-ui/icons/EmojiObjects';
import EmojiObjectsOutlinedIcon from '@material-ui/icons/EmojiObjectsOutlined';
import CloudIcon from '@material-ui/icons/Cloud';
import CloudOffIcon from '@material-ui/icons/CloudOff';
import { version } from '../../package.json';
import { useToggleTheme } from '../theme';

const Links = [{
  text: 'Contribute Idea',
  url: 'https://docs.google.com/forms/d/1YgroYi7_VRj2VrTxNa2ytV099MaVV9rGbC8KVH0tdx0/edit#responses',
}, {
  text: 'Future',
  url: 'https://github.com/coder13/LetsCube/wiki/Future',
}, {
  text: 'GitHub',
  url: 'https://github.com/coder13/letscube',
}, {
  text: 'Contact',
  url: 'mailto:choover11+letscube@gmail.com',
}, {
  text: `${version}`,
  url: 'https://github.com/coder13/letscube',
}];

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(1),
  },
  grow: {
    display: 'flex',
    flexDirection: 'row',
    flexGrow: 1,
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    alignItems: 'center',
  },
  link: {
    fontSize: '1.125em',
    margin: '.5em',
    verticalAlign: 'middle',
    color: theme.palette.text.primary,
    '&:hover': {
      textDecoration: 'none',
      opacity: 0.75,
    },
  },
  connectionStatusPopover: {
    padding: theme.spacing(2),
  },
}));

function Footer({
  user, server, roomList, socket,
}) {
  const classes = useStyles();
  const theme = useTheme();
  const toggleTheme = useToggleTheme();
  const [connectionStatusPopoverAnchorEl, setConnectionStatusPopoverAnchorEl] = useState(null);
  const connectionStatusPopoverOpen = Boolean(connectionStatusPopoverAnchorEl);

  return (
    <Paper square>
      <Grid
        container
        className={classes.root}
      >
        <Grid item>
          <Tooltip title="Toggle darkmode">
            <IconButton
              size="small"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              { theme.palette.type === 'dark'
                ? <EmojiObjectsIcon />
                : <EmojiObjectsOutlinedIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="View connection status">
            <IconButton
              size="small"
              onClick={(e) => setConnectionStatusPopoverAnchorEl(e.currentTarget)}
            >
              {(!roomList.connected || !socket.connected)
                ? <CloudOffIcon />
                : <CloudIcon />}
            </IconButton>
          </Tooltip>
        </Grid>
        <Grid item className={classes.grow}>
          {process.env.NODE_ENV === 'development' && (
            <Typography variant="body2">
              {server.URI}
            </Typography>
          )}
          {(user.id && +user.id === 8184) && (
            <Link
              className={classes.link}
              component={ReactRouterLink}
              variant="body2"
              to="/admin"
            >
              Admin
            </Link>
          )}
        </Grid>
        <Grid item>
          {Links.map((link) => (
            <Link
              key={link.text}
              className={classes.link}
              variant="body2"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {link.text}
            </Link>
          ))}
        </Grid>
      </Grid>
      <Popover
        id={connectionStatusPopoverOpen ? 'connection-status' : undefined}
        className={classes.connectionStatusPopover}
        open={connectionStatusPopoverOpen}
        onClose={() => setConnectionStatusPopoverAnchorEl(null)}
        anchorEl={connectionStatusPopoverAnchorEl}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <div className={classes.connectionStatusPopover}>
          <Typography>
            Server:
            {' '}
            {server.URI}
          </Typography>
          <Typography>
            Reconnecting:
            {' '}
            {server.reconnecting.toString()}
          </Typography>
          { server.reconnectAttempts > 0 && (
            <Typography>
              Reconnect Attempts:
              {' '}
              {server.reconnectAttempts}
            </Typography>
          )}

          <Typography>
            Connection Status to /rooms:
            {' '}
            {roomList.connected.toString()}
          </Typography>
          <Typography>
            Connection Status to /:
            {' '}
            {socket.connected.toString()}
          </Typography>
        </div>
      </Popover>
    </Paper>
  );
}

Footer.propTypes = {
  server: PropTypes.shape({
    URI: PropTypes.string,
    reconnecting: PropTypes.bool,
    reconnectAttempts: PropTypes.number,
  }),
  roomList: PropTypes.shape({
    connected: PropTypes.bool,
  }),
  socket: PropTypes.shape({
    connected: PropTypes.bool,
  }),
  user: PropTypes.shape({
    id: PropTypes.number,
  }),
};

Footer.defaultProps = {
  server: {
    URI: null,
    reconnecting: false,
    reconnectAttempts: 0,
  },
  roomList: {
    connected: true,
  },
  socket: {
    connected: true,
  },
  user: {
    id: undefined,
  },
};

const mapStateToProps = (state) => ({
  server: state.server,
  roomList: state.roomList,
  socket: state.socket,
  user: state.user,
});

export default connect(mapStateToProps)(Footer);
