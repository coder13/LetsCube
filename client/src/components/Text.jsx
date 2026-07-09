import React from 'react';
import PropTypes from 'prop-types';

const Text = ({ children }) => (
  <span
    style={{
      WebkitUserSelect: 'text',
    }}
  >
    {children}
  </span>
);

Text.propTypes = {
  children: PropTypes.node,
};

Text.defaultProps = {
  children: undefined,
};

export default Text;
