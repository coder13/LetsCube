import React, { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import FormControl from '@material-ui/core/FormControl';
import Input from '@material-ui/core/Input';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import Avatar from '@material-ui/core/Avatar';
import Typography from '@material-ui/core/Typography';
import ClickAwayListener from '@material-ui/core/ClickAwayListener';
import Icon from '@material-ui/core/Icon';
import NotificationImportantIcon from '@material-ui/icons/NotificationImportant';
import PersonIcon from '@material-ui/icons/Person';
import { sendChat } from '../../store/chat/actions';

const Icons = {
  USER: <PersonIcon />,
  ADMIN: <NotificationImportantIcon />,
  SCRAMBLE: (event) => <Icon className={`cubing-icon event-${event}`} />,
};

const useStyles = makeStyles(() => ({
  root: {
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
    height: '100%',
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
    backgroundColor: '#fefefe',
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
}));

function Chat({
  dispatch, messages, users, onFocus, onDefocus,
}) {
  const classes = useStyles();
  const [message, setMessage] = useState('');
  const listRef = useRef();
  const findUser = (id) => users.find((i) => i.id === id);

  const submit = () => {
    dispatch(sendChat({
      text: message,
    }));
    setMessage('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submit();
  };

  const handleChange = (e) => setMessage(e.target.value);

  useEffect(() => {
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  return (
    <ClickAwayListener onClickAway={onDefocus}>
      <Paper className={classes.root} variant="outlined" square onClick={onFocus}>
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

            const user = findUser(userId);
            const avatar = user && user.avatar.url;
            const displayAvatar = !avatar || index === 0 || messages[index - 1].userId !== user.id;
            const isNextMessageTheSameUser = messages[index + 1]
              && messages[index + 1].userId === user.id;

            return (
              <ListItem
                key={id}
                alignItems="flex-start"
                className={clsx(classes.message, {
                  [classes.lastMessageForUser]: !isNextMessageTheSameUser,
                })}
              >
                <ListItemAvatar>
                  {displayAvatar
                    && <Avatar src={user.avatar.url} />}
                </ListItemAvatar>

                <ListItemText
                  className={classes.selectable}
                  primary={displayAvatar ? user.displayName : ''}
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
        <Paper
          component="form"
          onSubmit={handleSubmit}
          className={classes.paper}
          elevation={8}
        >
          <FormControl fullWidth>
            <Input
              className={classes.input}
              fullWidth
              placeholder="Send message"
              value={message}
              onChange={handleChange}
            />
          </FormControl>
        </Paper>
      </Paper>
    </ClickAwayListener>
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
  onFocus: PropTypes.func,
  onDefocus: PropTypes.func,
};

Chat.defaultProps = {
  messages: [],
  users: [],
  onFocus: () => {},
  onDefocus: () => {},
};

const mapStateToProps = (state) => ({
  messages: state.chat.messages,
  users: state.chat.users,
});

export default connect(mapStateToProps)(Chat);
