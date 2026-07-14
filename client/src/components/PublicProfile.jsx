import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import Avatar from '@material-ui/core/Avatar';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Container from '@material-ui/core/Container';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import { lcFetch } from '../lib/fetch';
import { isFeatureEnabled } from '../lib/features';

const actionRequest = (action, id) => {
  const encodedId = encodeURIComponent(id);
  if (action === 'request') return { method: 'POST', url: '/api/friends/requests', body: { userId: id } };
  if (action === 'cancel') return { method: 'DELETE', url: `/api/friends/requests/${encodedId}` };
  if (action === 'accept' || action === 'decline') return { method: 'POST', url: `/api/friends/requests/${encodedId}/${action}` };
  if (action === 'unfriend') return { method: 'DELETE', url: `/api/friends/${encodedId}` };
  return { method: 'PUT', url: `/api/friends/blocks/${encodedId}` };
};

const actionLabel = {
  accept: 'Accept request',
  block: 'Block',
  cancel: 'Cancel request',
  decline: 'Decline',
  request: 'Send friend request',
  unfriend: 'Remove friend',
};

const relationshipLabel = {
  accepted: 'Friends',
  incoming: 'Friend request received',
  none: 'Not connected',
  outgoing: 'Friend request sent',
  self: 'This is you',
};

const useStyles = makeStyles((theme) => ({
  root: {
    paddingTop: theme.spacing(5),
  },
  card: {
    overflow: 'hidden',
  },
  identity: {
    alignItems: 'center',
    backgroundColor: theme.palette.action.hover,
    display: 'flex',
    padding: theme.spacing(3),
  },
  avatar: {
    height: theme.spacing(10),
    marginRight: theme.spacing(2),
    width: theme.spacing(10),
  },
  profileType: {
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  profileContent: {
    padding: theme.spacing(3),
  },
  relationship: {
    marginBottom: theme.spacing(2),
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(5),
  },
  notFound: {
    padding: theme.spacing(4),
    textAlign: 'center',
  },
}));

function PublicProfile() {
  const { id } = useParams();
  const classes = useStyles();
  const [profile, setProfile] = useState(null);
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
      <Container className={classes.root} maxWidth="sm">
        <Paper className={classes.notFound}>
          <Typography variant="h2">404</Typography>
          <Typography variant="h5">User not found</Typography>
          <Typography color="textSecondary" style={{ margin: '1rem 0' }}>
            This profile is unavailable or no longer public.
          </Typography>
          <Button component={Link} color="primary" to="/" variant="contained">Return to lobby</Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container className={classes.root} maxWidth="sm">
      <Paper className={classes.card}>
        {status === 'loading' && <div className={classes.loading}><CircularProgress aria-label="Loading profile" /></div>}
        {status === 'unavailable' && <div className={classes.notFound}><Typography role="status">Unable to load this profile right now.</Typography></div>}
        {status === 'ready' && profile && (
          <>
            <div className={classes.identity}>
              <Avatar
                alt={profile.displayName || profile.username}
                className={classes.avatar}
                src={profile.avatar && profile.avatar.thumb_url}
              />
              <div>
                <Typography className={classes.profileType} color="textSecondary" variant="caption">Cuber profile</Typography>
                <Typography variant="h4">{profile.displayName || profile.username}</Typography>
                {profile.username && <Typography color="textSecondary">{`@${profile.username}`}</Typography>}
              </div>
            </div>
            <div className={classes.profileContent}>
              {profile.wcaId && <Typography color="textSecondary">{`WCA ID: ${profile.wcaId}`}</Typography>}
              <Typography className={classes.relationship} variant="body1">
                {relationshipLabel[profile.relationship] || 'Not connected'}
              </Typography>
              <div className={classes.actions}>
                {isFeatureEnabled('friends') && profile.actions.map((action) => (
                  <Button
                    color={action === 'request' || action === 'accept' ? 'primary' : 'default'}
                    disabled={acting}
                    key={action}
                    onClick={() => act(action)}
                    variant={action === 'request' || action === 'accept' ? 'contained' : 'outlined'}
                  >
                    {actionLabel[action] || action}
                  </Button>
                ))}
                {profile.relationship === 'self' && (
                  <Button component={Link} color="primary" to="/profile" variant="outlined">Edit profile</Button>
                )}
              </div>
            </div>
          </>
        )}
      </Paper>
    </Container>
  );
}

export default PublicProfile;
