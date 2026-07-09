import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { connect, useDispatch } from 'react-redux';
import qs from 'qs';
import { Redirect, useLocation } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import LinearProgress from '@material-ui/core/LinearProgress';
import Alert from '@material-ui/lab/Alert';
import AlertTitle from '@material-ui/lab/AlertTitle';
import { lcFetch } from '../lib/fetch';
import { userChanged } from '../store/user/actions';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
  },
  paper: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    padding: theme.spacing(1),
  },
}));

const WCARedirect = ({ user }) => {
  const classes = useStyles();
  const dispatch = useDispatch();
  const query = qs.parse(useLocation().search, { ignoreQueryPrefix: true });
  const redirectUri = localStorage.getItem('letscube.redirect_uri');
  const { code } = query;
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    lcFetch('/auth/code', {
      method: 'POST',
      body: JSON.stringify({
        code,
        redirectUri,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((data) => data.json())
      .then((data) => {
        if (!data.ok) {
          setError(data);
        }
        setFetching(false);
        dispatch(userChanged(data));
      })
      .catch((err) => {
        setFetching(false);
        setError(err);
      });
  }, [dispatch, code, redirectUri]);

  return (
    <Box className={classes.root}>
      { error && (
        <Alert severity="error">
          <AlertTitle>An Error occured</AlertTitle>
          <br />
          { JSON.stringify(error) }
        </Alert>
      ) }
      { fetching && (
        <>
          <LinearProgress color="secondary" />
          <Paper className={classes.paper}>
            <Typography>
              fetching...
            </Typography>
          </Paper>
        </>
      )}
      { user && user.id && (
        <Redirect to={user.canJoinRoom ? '/' : '/profile'} />
      )}
    </Box>
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
