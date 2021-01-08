const origin = process.env.REACT_APP_API_ORIGIN || '';

export default (url, ...options) => (
  fetch(`${origin}${url}`, ...options)
);
