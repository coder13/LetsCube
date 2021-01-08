import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import ListItem from '@material-ui/core/ListItem';

function ListItemLink({ children, to, disabled }) {
  return (
    <ListItem button component={Link} to={to} disabled={disabled}>{children}</ListItem>
  );
}

ListItemLink.propTypes = {
  children: PropTypes.node.isRequired,
  to: PropTypes.string.isRequired,
  disabled: PropTypes.bool,
};

ListItemLink.defaultProps = {
  disabled: false,
};

export default ListItemLink;
