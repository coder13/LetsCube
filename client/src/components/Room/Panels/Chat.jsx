import React, { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { makeStyles } from '@mui/styles';
import Paper from '@mui/material/Paper';
import Toolbar from '@mui/material/Toolbar';
import FormControl from '@mui/material/FormControl';
import Input from '@mui/material/Input';
import Alert from '@mui/material/Alert';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemIcon from '@mui/material/ListItemIcon';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Icon from '@mui/material/Icon';
import NotificationImportantIcon from '@mui/icons-material/NotificationImportant';
import PersonIcon from '@mui/icons-material/Person';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { sendChat } from '../../../store/chat/actions';
import Panel from '../Common/Panel';

const Icons = {
  USER: <PersonIcon />,
  ADMIN: <NotificationImportantIcon />,
  SCRAMBLE: (event) => <Icon className={`cubing-icon event-${event}`} />,
};

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    flexGrow: 0,
    flexShrink: 1,
    width: '20rem',
    flexDirection: 'column',
    height: '100%',
    [theme.breakpoints.down('sm')]: {
      width: '100%',
      flexGrow: 1,
    },
  },
  closed: {
    flexGrow: 0,
    width: 0,
    position: 'relative',
    border: 'none',
  },
  messages: {
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
    overflowY: 'auto',
    height: 0,
    padding: 0,
  },
  paper: {
    display: 'flex',
    flexGrow: 0,
    width: '100%',
    padding: '1em',
    backgroundColor: theme.palette.background.default,
    borderRadius: 0,
  },
  message: {
    paddingTop: 0,
    paddingBottom: 0,
    margin: 0,
  },
  systemMessage: {
    marginTop: 0,
    marginBottom: 0,
  },
  lastMessageForUser: {
    marginBottom: '.5em',
  },
  selectable: {
    '-webkit-user-select': 'text',
    '-webkit-touch-callout': 'text',
    '-moz-user-select': 'text',
    '-ms-user-select': 'text',
    'user-select': 'text',
  },
  toolbarClosed: {
    position: 'absolute',
    width: '10em',
    right: 0,
  },
  hiddenOnMobile: {
    [theme.breakpoints.down('sm')]: {
      display: 'none',
    },
  },
}));

const UNKOWN_USER = {
  id: -1,
  displayName: 'Unknown User',
  avatar: {
    url: undefined,
  },
};

function Chat({
  dispatch, messages, users, user,
}) {
  const classes = useStyles();
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(true);
  const listRef = useRef();

  const findUser = (id) => {
    if (id > 0) {
      const u = users.find((i) => i.id === id);
      if (u) {
        return u;
      }
    }

    if (id === -2) {
      return {
        id: -2,
        displayName: 'System',
        avatar: {
          url: undefined,
        },
      };
    }

    return UNKOWN_USER;
  };

  const submit = () => {
    if (message.trim()) {
      dispatch(sendChat({
        text: message,
      }));
      setMessage('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submit();
  };

  const handleChange = (e) => setMessage(e.target.value);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  return (
    <Panel
      className={clsx(classes.root, {
        [classes.closed]: !open,
      })}
      toolbar={(
        <Toolbar
          variant="dense"
          className={clsx({
            [classes.toolbarClosed]: !open,
          })}
        >
          <Typography variant="h6" style={{ flexGrow: 1 }}>
            Chat
          </Typography>
          <IconButton className={classes.hiddenOnMobile} onClick={() => setOpen(!open)}>
            {open ? <ArrowForwardIcon /> : <ArrowBackIcon /> }
          </IconButton>
        </Toolbar>
      )}
    >
      {open && (
        <>
          <List className={classes.messages} ref={listRef}>
            {messages.map(({
              id, userId, text, secondary, icon, event,
            }, index) => {
              if (userId === -1) {
                return (
                  <ListItem dense key={id} className={classes.systemMessage}>
                    <ListItemIcon
                      style={{ display: 'block' }}
                    >
                      {icon === 'SCRAMBLE' ? Icons[icon](event) : Icons[icon]}
                    </ListItemIcon>

                    <ListItemText
                      className={classes.selectable}
                      primary={(
                        <Typography variant="body1">
                          {text}
                        </Typography>
                      )}
                      secondary={(
                        <Typography variant="body2">
                          {secondary}
                        </Typography>
                      )}
                    />
                  </ListItem>
                );
              }

              const sender = findUser(userId);
              const avatarUrl = sender && sender.avatar && sender.avatar.url;
              const shouldDisplayAvatar = !avatarUrl
                || index === 0 || messages[index - 1].userId !== sender.id;
              const isNextMessageTheSameSender = messages[index + 1]
                && messages[index + 1].userId === sender.id;

              return (
                <ListItem
                  key={id}
                  alignItems="flex-start"
                  className={clsx(classes.message, {
                    [classes.lastMessageForUser]: !isNextMessageTheSameSender,
                  })}
                >
                  <ListItemAvatar>
                    {shouldDisplayAvatar ? <Avatar src={avatarUrl} /> : <> </>}
                  </ListItemAvatar>

                  <ListItemText
                    className={classes.selectable}
                    primary={shouldDisplayAvatar ? sender.displayName : ''}
                    secondary={(
                      <Typography variant="body2">
                        {text}
                      </Typography>
                    )}
                  />
                </ListItem>
              );
            })}
          </List>
          {!user.id && (
            <Alert severity="warning">Login to chat</Alert>
          )}
          <Paper
            component="form"
            onSubmit={handleSubmit}
            className={classes.paper}
            elevation={8}
          >
            <FormControl fullWidth disabled={!user.id}>
              <Input
                className={classes.input}
                fullWidth
                placeholder="Send Message"
                value={message}
                onChange={handleChange}
              />
            </FormControl>
          </Paper>
        </>
      )}
    </Panel>
  );
}

Chat.propTypes = {
  messages: PropTypes.arrayOf(PropTypes.shape()),
  users: PropTypes.arrayOf(PropTypes.shape({
    displayName: PropTypes.string,
    avatar: PropTypes.shape({
      url: PropTypes.string,
    }),
  })),
  dispatch: PropTypes.func.isRequired,
  user: PropTypes.shape({
    id: PropTypes.number,
    canJoinRoom: PropTypes.bool,
  }),
};

Chat.defaultProps = {
  messages: [],
  users: [],
  user: {
    id: undefined,
    canJoinRoom: false,
  },
};

const mapStateToProps = (state) => ({
  messages: state.chat.messages,
  users: state.chat.users,
  user: state.user,
});

export default connect(mapStateToProps)(Chat);
