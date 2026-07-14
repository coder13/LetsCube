import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import Avatar from '@material-ui/core/Avatar';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Container from '@material-ui/core/Container';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Divider from '@material-ui/core/Divider';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import ListItemText from '@material-ui/core/ListItemText';
import Paper from '@material-ui/core/Paper';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import { lcFetch } from '../lib/fetch';
import createRequestSequence from '../lib/requestSequence';
import { createRoom } from '../store/rooms/actions';

const useStyles = makeStyles((theme) => ({
  root: {
    paddingTop: theme.spacing(4),
  },
  heading: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(2),
  },
  section: {
    padding: theme.spacing(2, 0),
  },
  sectionTitle: {
    padding: theme.spacing(0, 2),
  },
  empty: {
    padding: theme.spacing(1, 2),
  },
  action: {
    marginLeft: theme.spacing(1),
  },
  profileLink: {
    color: 'inherit',
    textDecoration: 'none',
  },
  search: {
    display: 'flex',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  searchField: {
    flexGrow: 1,
  },
  dialogError: {
    marginBottom: theme.spacing(1),
  },
}));

const userName = (user) => user.displayName || user.username || 'Unknown cuber';

const errorMessage = async (response, fallback) => {
  try {
    const body = await response.json();
    return body.message || fallback;
  } catch (error) {
    return fallback;
  }
};

function FriendEntry({ action, entry, secondary }) {
  const classes = useStyles();
  const user = entry.user;
  const name = user.profileKey
    ? <Link className={classes.profileLink} to={`/users/${user.profileKey}`}>{userName(user)}</Link>
    : userName(user);

  return (
    <ListItem>
      <ListItemAvatar>
        <Avatar alt={userName(user)} src={user.avatar && user.avatar.thumb_url} />
      </ListItemAvatar>
      <ListItemText primary={name} secondary={secondary} />
      {action}
    </ListItem>
  );
}

FriendEntry.propTypes = {
  action: PropTypes.node,
  entry: PropTypes.shape({
    user: PropTypes.shape({
      avatar: PropTypes.shape({ thumb_url: PropTypes.string }),
      displayName: PropTypes.string,
      profileKey: PropTypes.string,
      username: PropTypes.string,
    }).isRequired,
  }).isRequired,
  secondary: PropTypes.string.isRequired,
};

FriendEntry.defaultProps = {
  action: null,
};

function FriendsSection({ children, emptyMessage, title }) {
  const classes = useStyles();
  const entries = React.Children.toArray(children).filter(Boolean);

  return (
    <section className={classes.section}>
      <Typography className={classes.sectionTitle} variant="h6">{title}</Typography>
      {entries.length ? <List>{entries}</List> : <Typography className={classes.empty} color="textSecondary">{emptyMessage}</Typography>}
    </section>
  );
}

FriendsSection.propTypes = {
  children: PropTypes.node,
  emptyMessage: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
};

FriendsSection.defaultProps = {
  children: null,
};

function AddFriendDialog({ onClose, onRequest, open }) {
  const classes = useStyles();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [searching, setSearching] = useState(false);
  const searchRequests = useRef(createRequestSequence());

  useEffect(() => () => searchRequests.current.invalidate(), []);

  const search = (event) => {
    event.preventDefault();
    setError(null);
    setSearching(true);
    const request = searchRequests.current.start();
    lcFetch(`/api/users/search?q=${encodeURIComponent(query)}`, { signal: request.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await errorMessage(response, 'Unable to search for cubers'));
        return response.json();
      })
      .then((data) => {
        if (request.isCurrent()) setResults(data.results || []);
      })
      .catch((searchError) => {
        if (request.isCurrent() && searchError.name !== 'AbortError') setError(searchError.message);
      })
      .finally(() => {
        if (request.isCurrent()) setSearching(false);
      });
  };

  const requestFriend = (user) => {
    setError(null);
    onRequest(user)
      .then(() => onClose())
      .catch((requestError) => setError(requestError.message));
  };

  return (
    <Dialog fullWidth maxWidth="sm" onClose={onClose} open={open}>
      <DialogTitle>Add friend</DialogTitle>
      <DialogContent>
        <Typography color="textSecondary" gutterBottom>
          Search by username or a visible WCA ID.
        </Typography>
        <form className={classes.search} onSubmit={search}>
          <TextField
            className={classes.searchField}
            inputProps={{ 'aria-label': 'Find a cuber by username or visible WCA ID' }}
            label="Find a cuber"
            onChange={(event) => setQuery(event.target.value)}
            value={query}
          />
          <Button color="primary" disabled={searching} type="submit" variant="contained">Search</Button>
        </form>
        {error && <Typography className={classes.dialogError} color="error">{error}</Typography>}
        {searching && <CircularProgress aria-label="Searching for cubers" size={24} />}
        {!searching && results.length > 0 && (
          <List aria-label="Cuber search results">
            {results.map((user) => (
              <ListItem key={user.id}>
                <ListItemAvatar>
                  <Avatar alt={userName(user)} src={user.avatar && user.avatar.thumb_url} />
                </ListItemAvatar>
                <ListItemText primary={userName(user)} secondary={user.username && `@${user.username}`} />
                <Button color="primary" onClick={() => requestFriend(user)} variant="outlined">Add</Button>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

AddFriendDialog.propTypes = {
  onClose: PropTypes.func.isRequired,
  onRequest: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
};

function Friends() {
  const classes = useStyles();
  const dispatch = useDispatch();
  const [data, setData] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadFriends = useCallback(() => {
    setLoading(true);
    setError(null);
    return lcFetch('/api/friends')
      .then(async (response) => {
        if (!response.ok) throw new Error(await errorMessage(response, 'Unable to load friends'));
        return response.json();
      })
      .then((response) => setData(response))
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  const performAction = (url, method, body) => lcFetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (response) => {
    if (!response.ok) throw new Error(await errorMessage(response, 'Unable to update friendship'));
    return loadFriends();
  });

  const requestFriend = (user) => performAction('/api/friends/requests', 'POST', { userId: user.id });
  const raceWith = (user) => {
    dispatch(createRoom({
      name: `Race with ${userName(user)}`,
      raceWithUserId: user.id,
      type: 'normal',
    }));
  };
  const handleAction = (url, method, body) => {
    performAction(url, method, body).catch((actionError) => setError(actionError.message));
  };

  return (
    <Container className={classes.root} maxWidth="sm">
      <div className={classes.heading}>
        <div>
          <Typography variant="h4">Friends</Typography>
          <Typography color="textSecondary">Manage your cubing connections.</Typography>
        </div>
        <Button color="primary" onClick={() => setDialogOpen(true)} variant="contained">Add friend</Button>
      </div>
      <Paper>
        {loading && <div className={classes.empty}><CircularProgress aria-label="Loading friends" size={24} /></div>}
        {error && <Typography className={classes.empty} color="error">{error}</Typography>}
        {!loading && data && (
          <>
            <FriendsSection emptyMessage="No incoming friend requests." title="Requests for you">
              {data.incoming.map((entry) => (
                <FriendEntry
                  action={(
                    <>
                      <Button className={classes.action} color="primary" onClick={() => handleAction(`/api/friends/requests/${entry.user.id}/accept`, 'POST')} variant="contained">Accept</Button>
                      <Button className={classes.action} onClick={() => handleAction(`/api/friends/requests/${entry.user.id}/decline`, 'POST')}>Decline</Button>
                    </>
                  )}
                  entry={entry}
                  key={entry.user.id}
                  secondary="Wants to be friends"
                />
              ))}
            </FriendsSection>
            <Divider />
            <FriendsSection emptyMessage="No outgoing requests." title="Sent requests">
              {data.outgoing.map((entry) => (
                <FriendEntry
                  action={<Button className={classes.action} onClick={() => handleAction(`/api/friends/requests/${entry.user.id}`, 'DELETE')}>Cancel</Button>}
                  entry={entry}
                  key={entry.user.id}
                  secondary="Waiting for a response"
                />
              ))}
            </FriendsSection>
            <Divider />
            <FriendsSection emptyMessage="No friends yet. Add a cuber to get started." title="Your friends">
              {data.friends.map((entry) => (
                <FriendEntry
                  action={(
                    <>
                      <Button className={classes.action} color="primary" onClick={() => raceWith(entry.user)} variant="contained">Race with me</Button>
                      <Button className={classes.action} onClick={() => handleAction(`/api/friends/${entry.user.id}`, 'DELETE')}>Remove</Button>
                    </>
                  )}
                  entry={entry}
                  key={entry.user.id}
                  secondary="Friends"
                />
              ))}
            </FriendsSection>
          </>
        )}
      </Paper>
      <AddFriendDialog
        onClose={() => setDialogOpen(false)}
        onRequest={requestFriend}
        open={dialogOpen}
      />
    </Container>
  );
}

export default Friends;
