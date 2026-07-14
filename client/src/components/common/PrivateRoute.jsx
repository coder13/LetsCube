import React from 'react';
import PropTypes from 'prop-types';
import { Route, Redirect } from 'react-router-dom';
import { connect } from 'react-redux';

const PrivateRoute = ({
  user, isAdminRoute, ...rest
}) => {
  const { fetching, id } = user;
  const loggedIn = !fetching && id;
  const cailyn = loggedIn && +id === 8184;

  if (!loggedIn) {
    return (<Redirect to="/" />);
  }

  if (isAdminRoute && !cailyn) {
    return (<Redirect to="/" />);
  }

  return (
    <Route {...rest} />
  );
};

PrivateRoute.propTypes = {
  isAdminRoute: PropTypes.bool,
  user: PropTypes.shape(),
};

PrivateRoute.defaultProps = {
  isAdminRoute: false,
  user: {
  },
};

const mapStateToProps = (state) => ({
  user: state.user,
});

export default connect(mapStateToProps)(PrivateRoute);
