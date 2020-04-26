import React from 'react';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Link from '@material-ui/core/Link';
import IconButton from '@material-ui/core/IconButton';
import EmojiObjectsIcon from '@material-ui/icons/EmojiObjects';
import EmojiObjectsOutlinedIcon from '@material-ui/icons/EmojiObjectsOutlined';
import { version } from '../../package.json';
import { useToggleTheme } from '../theme';
import UserCounter from './UserCounter';

const Links = [{
  text: 'Contribute Idea',
  url: 'https://docs.google.com/forms/d/1YgroYi7_VRj2VrTxNa2ytV099MaVV9rGbC8KVH0tdx0/edit#responses',
}, {
  text: 'Future',
  url: 'https://github.com/coder13/LetsCube/wiki/Future',
}, {
  text: 'GitHub',
  url: 'https://github.com/coder13/letscube',
}, {
  text: 'Contact',
  url: 'mailto:choover11+letscube@gmail.com',
}, {
  text: `${version}`,
  url: 'https://github.com/coder13/letscube',
}];

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(1),
  },
  grow: {
    flexGrow: 1,
  },
  link: {
    fontSize: '1.125em',
    margin: '.5em',
    verticalAlign: 'middle',
    color: theme.palette.text.primary,
    '&:hover': {
      textDecoration: 'none',
      opacity: 0.75,
    },
  },
}));

function Footer() {
  const classes = useStyles();
  const theme = useTheme();
  const toggleTheme = useToggleTheme();

  return (
    <Paper square>
      <Grid
        container
        className={classes.root}
      >
        <Grid item>
          <IconButton
            size="small"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme.palette.type === 'dark' ? (
              <EmojiObjectsIcon />
            ) : (
              <EmojiObjectsOutlinedIcon />
            )}
          </IconButton>
        </Grid>
        <Grid item>
          <UserCounter />
        </Grid>
        <Grid item className={classes.grow} />
        <Grid item>
          {Links.map((link) => (
            <Link
              key={link.text}
              className={classes.link}
              variant="body2"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {link.text}
            </Link>
          ))}
        </Grid>
      </Grid>
    </Paper>
  );
}

export default Footer;
