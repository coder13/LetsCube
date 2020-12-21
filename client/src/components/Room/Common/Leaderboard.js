import React from 'react';
import { connect } from 'react-redux';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';

const useStyles = makeStyles(() => ({
  root: {},
}));

function Leaderboard() {
  const classes = useStyles();
  return (
    <Paper className={classes.root} variant="outlined" square />
  );
}

Leaderboard.propTypes = {
};

Leaderboard.defaultProps = {
};

const mapStateToProps = () => ({});

export default connect(mapStateToProps)(Leaderboard);
