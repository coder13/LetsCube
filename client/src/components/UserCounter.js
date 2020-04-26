import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
// import { makeStyles } from '@material-ui/core/styles';
// import Paper from '@material-ui/core/Paper';
// import Typography from '@material-ui/core/Typography'

function UserCounter({ userCount }) {
  return (
    <p>
      {`Users Online: ${userCount}`}
    </p>
  );
}

UserCounter.propTypes = {
  userCount: PropTypes.number,
};

UserCounter.defaultProps = {
  userCount: 100000000000000,
};

const mapStateToProps = (state) => ({
  userCount: state.server.user_count,
})

export default connect(mapStateToProps)(UserCounter);
