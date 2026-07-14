import React from 'react';
import ReactMarkdown from 'react-markdown';
import { makeStyles } from '@mui/styles';
import Paper from '@mui/material/Paper';
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

  if (!announcements) {
    return false;
  }

  return (
    <Paper className={classes.root}>
      <ReactMarkdown linkTarget="_blank">
        {announcements}
      </ReactMarkdown>
    </Paper>
  );
}

export default Announcements;
