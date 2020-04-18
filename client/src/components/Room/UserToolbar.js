import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import Toolbar from '@material-ui/core/Toolbar';
import FormGroup from '@material-ui/core/FormGroup';
import Button from '@material-ui/core/Button';
import { updateCompeting } from '../../store/room/actions';

const useStyles = makeStyles(() => ({
  root: {
    alignItems: 'stretch',
    minHeight: '5em',
    padding: 0,
    flexGrow: 1,
  },
}));

function UserToolbar({ dispatch, room, user }) {
  const classes = useStyles();
  const userCompeting = room.competing[user.id];

  const handleCompeting = () => {
    dispatch(updateCompeting(!userCompeting));
  };

  return (
    <Toolbar className={classes.root}>
      <FormGroup row variant="text">
        <Button onClick={handleCompeting}>
          {userCompeting ? 'Start Skipping' : 'Start Competing'}
        </Button>
      </FormGroup>
    </Toolbar>
  );
}

UserToolbar.propTypes = {
  dispatch: PropTypes.func.isRequired,
  room: PropTypes.shape({
    competing: PropTypes.shape(),
  }),
  user: PropTypes.shape({
    id: PropTypes.number,
  }),
};

UserToolbar.defaultProps = {
  room: {
    competing: {},
  },
  user: {
    id: undefined,
  },
};

const mapStateToProps = (state) => ({
  room: state.room,
  user: state.user,
});

export default connect(mapStateToProps)(UserToolbar);
