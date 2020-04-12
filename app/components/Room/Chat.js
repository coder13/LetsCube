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
import NotificationImportantIcon from '@material-ui/icons/NotificationImportant';
import { sendChat } from '../../store/chat/actions';

const Icons = {
  ADMIN: <NotificationImportantIcon />,
};

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
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
    border: `1px solid ${theme.palette.divider}`,
  },
  message: {
    paddingTop: 0,
    paddingBottom: 0,
    margin: 0,
  },
  systemMessage: {
    marginTop: '.5em',
    marginBottom: '.5em',
  },
  lastMessageForUser: {
    marginBottom: '.5em',
  },
}));

function Chat({ dispatch, messages, users }) {
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
    <Paper className={classes.root} elevation={1}>
      <List className={classes.messages} ref={listRef}>
        {messages.map(({
          id, userId, text, icon,
        }, index) => {
          if (userId === -1) {
            return (
              <ListItem dense key={id} className={classes.systemMessage}>
                <ListItemIcon>{Icons[icon]}</ListItemIcon>

                <ListItemText
                  primary={(
                    <Typography variant="body1">
                      {text}
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
};

Chat.defaultProps = {
  messages: [],
  users: [],
};

const mapStateToProps = (state) => ({
  messages: state.chat.messages,
  users: state.chat.users,
});

export default connect(mapStateToProps)(Chat);
