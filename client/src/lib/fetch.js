// const origin = process.env.REACT_APP_API_ORIGIN || '';

export const apiOrigin = process.env.REACT_APP_API_ORIGIN;

export const lcFetch = (url, options) => (
  fetch(`${apiOrigin}${url}`, {
    ...options,
    credentials: 'include',
  })
);
