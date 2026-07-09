import React from 'react';
import PropTypes from 'prop-types';
import { Route, Redirect } from 'react-router-dom';
import { connect } from 'react-redux';

const PrivateRoute = ({
  user, children, isAdminRoute, ...rest
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
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
  isAdminRoute: PropTypes.bool,
  user: PropTypes.shape(),
};

PrivateRoute.defaultProps = {
  children: [],
  isAdminRoute: false,
  user: {
  },
};

const mapStateToProps = (state) => ({
  user: state.user,
});

export default connect(mapStateToProps)(PrivateRoute);
