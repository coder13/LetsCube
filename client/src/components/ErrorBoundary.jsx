import React from 'react';
import PropTypes from 'prop-types';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, details) {
    this.props.reportError(error, details);
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }

    return (
      <main role="alert" style={{ margin: '4rem auto', maxWidth: '32rem', padding: '1rem' }}>
        <h1>Let&apos;s Cube stopped unexpectedly.</h1>
        <p>If you have a saved result, it remains on this device. Reload the app to recover.</p>
        <button type="button" onClick={this.props.onReload}>Reload app</button>
      </main>
    );
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  onReload: PropTypes.func,
  reportError: PropTypes.func,
};

ErrorBoundary.defaultProps = {
  onReload: () => window.location.reload(),
  // The browser console is the only error sink configured in this client.
  // eslint-disable-next-line no-console
  reportError: (error, details) => console.error(error, details),
};

export default ErrorBoundary;
