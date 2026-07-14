import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import Avatar from '@material-ui/core/Avatar';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Paper from '@material-ui/core/Paper';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { lcFetch } from '../lib/fetch';

const actionRequest = (action, id) => {
  const encodedId = encodeURIComponent(id);
  if (action === 'request') return { method: 'POST', url: '/api/friends/requests', body: { userId: id } };
  if (action === 'cancel') return { method: 'DELETE', url: `/api/friends/requests/${encodedId}` };
  if (action === 'accept' || action === 'decline') return { method: 'POST', url: `/api/friends/requests/${encodedId}/${action}` };
  if (action === 'unfriend') return { method: 'DELETE', url: `/api/friends/${encodedId}` };
  return { method: 'PUT', url: `/api/friends/blocks/${encodedId}` };
};

function PublicProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('loading');
  const [acting, setActing] = useState(false);
  const requestSequence = useRef(0);

  const load = useCallback((profileKey) => {
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    setStatus('loading');
    lcFetch(`/api/users/${encodeURIComponent(profileKey)}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((data) => {
        if (requestSequence.current !== requestId) return;
        setProfile(data);
        setStatus('ready');
      })
      .catch((response) => {
        if (requestSequence.current === requestId) {
          setStatus(response && response.status === 404 ? 'not-found' : 'unavailable');
        }
      });
  }, []);

  useEffect(() => load(id), [id, load]);

  const searchUsers = (event) => {
    event.preventDefault();
    lcFetch(`/api/users/search?q=${encodeURIComponent(search)}`)
      .then((response) => (response.ok ? response.json() : { results: [] }))
      .then((data) => setResults(data.results || []))
      .catch(() => setResults([]));
  };

  const act = (action) => {
    if (!profile || acting) return;
    setActing(true);
    const request = actionRequest(action, profile.id);
    lcFetch(request.url, {
      method: request.method,
      headers: request.body ? { 'Content-Type': 'application/json' } : undefined,
      body: request.body ? JSON.stringify(request.body) : undefined,
    }).then(() => load(profile.profileKey)).finally(() => setActing(false));
  };

  if (status === 'not-found') {
    return (
      <Paper style={{
        margin: 'auto', maxWidth: 560, padding: 24, textAlign: 'center', width: '100%',
      }}
      >
        <Typography variant="h2">404</Typography>
        <Typography variant="h5">User not found</Typography>
        <Typography color="textSecondary" style={{ margin: '1rem 0' }}>
          This profile is unavailable or no longer public.
        </Typography>
        <Button component={Link} color="primary" to="/" variant="contained">Return to lobby</Button>
      </Paper>
    );
  }

  return (
    <Paper style={{
      margin: 'auto', maxWidth: 560, padding: 24, width: '100%',
    }}
    >
      <form onSubmit={searchUsers} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <TextField
          aria-label="Find a cuber by username or visible WCA ID"
          label="Find a cuber"
          onChange={(event) => setSearch(event.target.value)}
          value={search}
        />
        <Button color="primary" type="submit" variant="contained">Search</Button>
      </form>
      {results.map((user) => (
        <Button component={Link} key={user.id} to={`/users/${user.profileKey}`}>
          {user.displayName || user.username}
        </Button>
      ))}
      {status === 'loading' && <CircularProgress aria-label="Loading profile" />}
      {status === 'unavailable' && <Typography role="status">Unable to load this profile right now.</Typography>}
      {status === 'ready' && profile && (
        <>
          <Avatar
            alt={profile.displayName || profile.username}
            src={profile.avatar && profile.avatar.thumb_url}
          />
          <Typography variant="h5">{profile.displayName || profile.username}</Typography>
          {profile.username && <Typography>{`@${profile.username}`}</Typography>}
          {profile.wcaId && <Typography>{`WCA ID: ${profile.wcaId}`}</Typography>}
          <Typography>{profile.relationship}</Typography>
          {profile.actions.map((action) => (
            <Button disabled={acting} key={action} onClick={() => act(action)}>
              {action}
            </Button>
          ))}
        </>
      )}
    </Paper>
  );
}

export default PublicProfile;
