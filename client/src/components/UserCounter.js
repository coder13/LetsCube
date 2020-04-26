import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
// import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
// import Typography from '@material-ui/core/Typography'

function UserCounter({ userCount }) {
  return (
    <Paper>
      <p>
        {`Users Online: ${userCount}`}
      </p>
    </Paper>

  );
}

UserCounter.propTypes = {
  userCount: PropTypes.number,
};

UserCounter.defaultProps = {
  userCount: 0,
};

const mapStateToProps = (state) => ({
  userCount: state.server.user_count,
})

export default connect(mapStateToProps)(UserCounter);
