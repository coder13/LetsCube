import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';
import Paper from '@material-ui/core/Paper';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import { lcFetch } from '../lib/fetch';

const useStyles = makeStyles((theme) => ({
  root: {
    paddingTop: theme.spacing(5),
  },
  panel: {
    padding: theme.spacing(3),
  },
  form: {
    display: 'flex',
    gap: theme.spacing(1),
    marginTop: theme.spacing(3),
  },
  input: {
    flexGrow: 1,
  },
  results: {
    display: 'flex',
    flexDirection: 'column',
    marginTop: theme.spacing(2),
  },
  result: {
    justifyContent: 'flex-start',
  },
}));

function UserDiscovery() {
  const classes = useStyles();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);

  const searchUsers = (event) => {
    event.preventDefault();
    lcFetch(`/api/users/search?q=${encodeURIComponent(search)}`)
      .then((response) => (response.ok ? response.json() : { results: [] }))
      .then((data) => {
        setResults(data.results || []);
        setSearched(true);
      })
      .catch(() => {
        setResults([]);
        setSearched(true);
      });
  };

  return (
    <Container className={classes.root} maxWidth="sm">
      <Paper className={classes.panel}>
        <Typography variant="h4">Find cubers</Typography>
        <Typography color="textSecondary">
          Search by username or a visible WCA ID.
        </Typography>
        <form className={classes.form} onSubmit={searchUsers}>
          <TextField
            aria-label="Find a cuber by username or visible WCA ID"
            className={classes.input}
            label="Find a cuber"
            onChange={(event) => setSearch(event.target.value)}
            value={search}
          />
          <Button color="primary" type="submit" variant="contained">Search</Button>
        </form>
        <div className={classes.results}>
          {results.map((user) => (
            <Button className={classes.result} component={Link} key={user.id} to={`/users/${user.profileKey}`}>
              {user.displayName || user.username}
            </Button>
          ))}
          {searched && results.length === 0 && (
            <Typography color="textSecondary" variant="body2">No matching cubers found.</Typography>
          )}
        </div>
      </Paper>
    </Container>
  );
}

export default UserDiscovery;
