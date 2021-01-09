import React, { useEffect, useState } from 'react';
import qs from 'qs';
import { useLocation } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import { lcFetch } from '../lib/fetch';

const useStyles = makeStyles(() => ({
  root: {
    flexGrow: 1,
    padding: '1em',
  },
}));

export default () => {
  const classes = useStyles();
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
    </Paper>
  );
};
