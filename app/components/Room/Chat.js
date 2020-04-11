import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(() => ({
  root: {

  },
}));

function Chat({ messages }) {
  const classes = useStyles();
  console.log(messages);

  return (
    <div className={classes.root}>
      <h6>chat</h6>
    </div>
  );
}

Chat.propTypes = {
  messages: PropTypes.arrayOf(PropTypes.shape()),
};

Chat.defaultProps = {
  messages: [],
};

const mapStateToProps = (state) => ({
  messages: state.chat.messages,
  users: state.room.users,
});

export default connect(mapStateToProps)(Chat);
