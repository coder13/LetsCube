import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import Link from '@material-ui/core/Link';
import { Link as ReactRouterLink } from 'react-router-dom';
import IconButton from '@material-ui/core/IconButton';
import EmojiObjectsIcon from '@material-ui/icons/EmojiObjects';
import EmojiObjectsOutlinedIcon from '@material-ui/icons/EmojiObjectsOutlined';
import { version } from '../../package.json';
import { useToggleTheme } from '../theme';

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
    display: 'flex',
    flexDirection: 'row',
    flexGrow: 1,
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    alignItems: 'center',
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

function Footer({ user, socket }) {
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
        <Grid item className={classes.grow}>
          {process.env.NODE_ENV === 'development' && (
            <Typography variant="body2">
              {socket.URI}
            </Typography>
          )}
          {(user.id && +user.id === 8184) && (
            <Link
              className={classes.link}
              component={ReactRouterLink}
              variant="body2"
              to="/admin"
            >
              Admin
            </Link>
          )}
        </Grid>
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

Footer.propTypes = {
  socket: PropTypes.shape({
    URI: PropTypes.string,
  }),
  user: PropTypes.shape({
    id: PropTypes.number,
  }),
};

Footer.defaultProps = {
  socket: {
    URI: null,
  },
  user: {
    id: undefined,
  },
};

const mapStateToProps = (state) => ({
  socket: state.socket,
  user: state.user,
});

export default connect(mapStateToProps)(Footer);
