import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { connect, useDispatch } from 'react-redux';
import qs from 'qs';
import { useLocation } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import { lcFetch } from '../lib/fetch';
import { userChanged } from '../store/user/actions';

const useStyles = makeStyles(() => ({
  root: {
    flexGrow: 1,
    padding: '1em',
  },
}));

const WCARedirect = ({ user }) => {
  const classes = useStyles();
  const dispatch = useDispatch();
  const query = qs.parse(useLocation().search, { ignoreQueryPrefix: true });
  const redirectUri = localStorage.getItem('letscube.redirect_uri')
  const { code } = query;
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    lcFetch(`/auth/code?code=${code}&redirectUri=${redirectUri}`)
      .then((data) => data.json())
      .then((data) => {
        console.log(data);
        if (!data.ok) {
          setError(data);
        }
        setFetching(false);
        dispatch(userChanged(data))
      })
      .catch((err) => {
        console.error(err);
        setFetching(false);
        setError(err);
      })
  }, [code]);

  return (
    <Paper className={classes.root}>
      { fetching && 'fetching...' }
      { error && JSON.stringify(error) }
      { user && user.id }
    </Paper>
  );
};

WCARedirect.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.number,
    canJoinRoom: PropTypes.bool,
  }),
};

WCARedirect.defaultProps = {
  user: {
    id: undefined,
    canJoinRoom: undefined,
  },
};

const mapStateToProps = (state) => ({
  user: state.user,
});

export default connect(mapStateToProps)(WCARedirect);
