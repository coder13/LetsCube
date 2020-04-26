import React from 'react';
import PropTypes from 'prop-types';
// import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
// import Typography from '@material-ui/core/Typography'

function UserCounter({ userCount }) {
  return (
    <Paper variant="outlined">
      <p>
        {userCount}
      </p>
    </Paper>
  );
}

UserCounter.propTypes = {
  userCount: PropTypes.number,
};

UserCounter.defaultProps = {
  userCount: 100000000000000,
};

export default UserCounter;
