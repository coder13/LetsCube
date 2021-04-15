import React from 'react';
import PropTypes from 'prop-types';
import { Route, Redirect } from 'react-router-dom';
import { connect } from 'react-redux';

const PrivateRoute = ({
  user, children, isCalebRoute, ...rest
}) => {
  const { fetching, id } = user;
  const loggedIn = !fetching && id;
  const caleb = loggedIn && +id === 8184;

  if (!loggedIn) {
    return (<Redirect to="/" />);
  }

  if (isCalebRoute && !caleb) {
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
  isCalebRoute: PropTypes.bool,
  user: PropTypes.shape(),
};

PrivateRoute.defaultProps = {
  children: [],
  isCalebRoute: false,
  user: {
  },
};

const mapStateToProps = (state) => ({
  user: state.user,
});

export default connect(mapStateToProps)(PrivateRoute);
