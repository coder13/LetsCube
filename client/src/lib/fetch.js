// const origin = process.env.REACT_APP_API_ORIGIN || '';

export const apiOrigin = (process.env.NODE_ENV === 'development'
  ? `http://${window.location.hostname}:8080`
  : process.env.REACT_APP_API_ORIGIN);

export const lcFetch = (url, ...options) => (
  fetch(`${apiOrigin}${url}`, ...options)
);
