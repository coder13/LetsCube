import React from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Popover from '@material-ui/core/Popover';
import Typography from '@material-ui/core/Typography';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    textAlign: 'center',
  },
  name: {
    padding: 0,
    fontSize: '.75rem',
  },
  paper: {
    padding: theme.spacing(1),
  },
  popover: {
    pointerEvents: 'none',
  },
  p: {
    paddingBottom: '.5em',
  },
  admin: {
    color: theme.palette.primary.dark,
  },
}));

function User({ user, admin }) {
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = React.useState(null);

  const handlePopoverOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handlePopoverClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  return (
    <div
      className={clsx(classes.root, {
        [classes.admin]: admin,
      })}
    >
      <Typography
        className={classes.name}
        aria-haspopup="true"
        onMouseEnter={handlePopoverOpen}
        onMouseLeave={handlePopoverClose}
        component="span"
        variant="subtitle2"
      >
        {user.displayName}
      </Typography>
      <Popover
        id={`${user.displayName}-info`}
        className={classes.popover}
        classes={{
          paper: classes.paper,
        }}
        open={open}
        anchorEl={anchorEl}
        onClose={handlePopoverClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        disableRestoreFocus
      >
        {admin && (
          <Typography className={classes.p} variant="h6">
            In Control
          </Typography>
        )}
        {user.wcaId && (
          <Typography className={classes.p} variant="body1">
            {`WCA ID: ${user.wcaId}`}
          </Typography>
        )}
        {user.name && (
          <Typography className={classes.p} variant="body1">
            {`Name: ${user.name}`}
          </Typography>
        )}
        {user.username && (
          <Typography className={classes.p} variant="body1">
            {`Username: ${user.username}`}
          </Typography>
        )}
      </Popover>
    </div>
  );
}

User.propTypes = {
  user: PropTypes.shape({
    displayName: PropTypes.string,
    username: PropTypes.string,
    wcaId: PropTypes.string,
    name: PropTypes.string,
    showWCAID: PropTypes.bool,
  }).isRequired,
  admin: PropTypes.bool,
};

User.defaultProps = {
  admin: false,
};

export default User;
