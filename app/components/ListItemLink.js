import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import ListItem from '@material-ui/core/ListItem';

function ListItemLink({ children, to }) {
  return (
    <ListItem button component={Link} to={to}>{children}</ListItem>
  );
}

ListItemLink.propTypes = {
  children: PropTypes.arrayOf(PropTypes.element).isRequired,
  to: PropTypes.string.isRequired,
};

export default ListItemLink;
