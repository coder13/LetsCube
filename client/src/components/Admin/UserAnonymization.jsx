import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Card from '@material-ui/core/Card';
import CardActions from '@material-ui/core/CardActions';
import CardContent from '@material-ui/core/CardContent';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import Alert from '@material-ui/lab/Alert';
import { useConfirm } from 'material-ui-confirm';
import { anonymizeAdminUser, searchAdminUsers } from '../../store/admin/actions';

const useStyles = makeStyles(() => ({
  form: {
    display: 'flex',
    gap: '1em',
    marginBottom: '1em',
  },
  input: {
    flexGrow: 1,
  },
  result: {
    marginTop: '1em',
  },
}));

const valueOrDash = (value) => value || '—';

function UserAnonymization() {
  const dispatch = useDispatch();
  const confirm = useConfirm();
  const classes = useStyles();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [anonymizingId, setAnonymizingId] = useState(null);
  const [message, setMessage] = useState(null);

  const handleSearch = (event) => {
    event.preventDefault();
    setSearching(true);
    setMessage(null);
    dispatch(searchAdminUsers(query, (error, results = []) => {
      setSearching(false);
      if (error) {
        setUsers([]);
        setMessage({ severity: 'error', text: error.message });
        return;
      }
      setUsers(results);
      if (results.length === 0) {
        setMessage({ severity: 'info', text: 'No matching users found.' });
      }
    }));
  };

  const handleAnonymize = (user) => {
    confirm({
      title: user.anonymizedAt
        ? `Reapply the scrub for user ${user.id}?`
        : `Anonymize user ${user.id}?`,
      description: user.anonymizedAt
        ? 'This retries the identity scrub in all configured data stores.'
        : 'This permanently removes their name, username, email, WCA ID, avatar, and stored WCA token while retaining their history.',
      confirmationText: user.anonymizedAt ? 'Reapply scrub' : 'Anonymize user',
      cancellationText: 'Cancel',
    }).then(() => {
      setAnonymizingId(user.id);
      setMessage(null);
      dispatch(anonymizeAdminUser(user.id, (error, result) => {
        setAnonymizingId(null);
        if (error) {
          setMessage({ severity: 'error', text: error.message });
          return;
        }
        setUsers((currentUsers) => currentUsers.map((currentUser) => (
          currentUser.id === user.id ? result.user : currentUser
        )));
        setMessage({
          severity: result.postgresMirrorFailed ? 'warning' : 'success',
          text: result.postgresMirrorFailed
            ? `User ${user.id} was scrubbed from MongoDB, but the PostgreSQL scrub could not be confirmed. Reapply the scrub after PostgreSQL recovers.`
            : (result.alreadyAnonymized
              ? `User ${user.id} was already anonymized; its scrub was reapplied.`
              : `User ${user.id} has been anonymized.`),
        });
      }));
    }).catch(() => {});
  };

  return (
    <section>
      <Typography variant="h5" component="h2">Anonymize a user</Typography>
      <Typography paragraph>
        Search by internal ID, WCA ID, name, username, or email.
      </Typography>
      <form className={classes.form} onSubmit={handleSearch}>
        <TextField
          className={classes.input}
          label="Find user"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          inputProps={{ 'aria-label': 'Find user' }}
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={searching || query.trim().length < 2}
        >
          {searching ? 'Searching…' : 'Search'}
        </Button>
      </form>
      {message && <Alert severity={message.severity}>{message.text}</Alert>}
      {users.map((user) => (
        <Card className={classes.result} key={user.id}>
          <CardContent>
            <Typography variant="h6">{`User ${user.id}`}</Typography>
            <Typography>{`Name: ${valueOrDash(user.name)}`}</Typography>
            <Typography>{`Username: ${valueOrDash(user.username)}`}</Typography>
            <Typography>{`Email: ${valueOrDash(user.email)}`}</Typography>
            <Typography>{`WCA ID: ${valueOrDash(user.wcaId)}`}</Typography>
            <Typography>
              {user.anonymizedAt
                ? `Anonymized: ${new Date(user.anonymizedAt).toLocaleString()}`
                : 'Not anonymized'}
            </Typography>
          </CardContent>
          <CardActions>
            <Button
              color="secondary"
              disabled={anonymizingId !== null}
              onClick={() => handleAnonymize(user)}
            >
              {anonymizingId === user.id
                ? 'Applying scrub…'
                : (user.anonymizedAt ? 'Reapply scrub' : 'Anonymize')}
            </Button>
          </CardActions>
        </Card>
      ))}
    </section>
  );
}

export default UserAnonymization;
