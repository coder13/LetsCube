import React from 'react';
import ReactMarkdown from 'react-markdown';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import { lcFetch } from '../../lib/fetch';

const useStyles = makeStyles({
  root: {
    padding: '1em',
    marginTop: '1em',
    marginBottom: '1em',
  },
});

function Announcements() {
  const [announcements, setAnnouncements] = React.useState('');
  const classes = useStyles();

  React.useEffect(() => {
    lcFetch('/api/announcements')
      .then((data) => {
        if (!data.ok) {
          throw new Error();
        }
        return data.text();
      })
      .then((data) => {
        setAnnouncements(data);
      })
      .catch((err) => {
        throw err;
      });
  }, []);

  return (
    <Paper className={classes.root}>
      <ReactMarkdown
        linkTarget="_blank"
        source={announcements}
      />
    </Paper>
  );
}

export default Announcements;
