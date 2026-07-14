// const origin = process.env.REACT_APP_API_ORIGIN || '';

export const apiOrigin = process.env.REACT_APP_API_ORIGIN;

const UNSAFE_METHODS = new Set(['DELETE', 'PATCH', 'POST', 'PUT']);
let csrfTokenRequest;

const requestCsrfToken = async () => {
  if (!csrfTokenRequest) {
    csrfTokenRequest = fetch(`${apiOrigin}/api/csrf-token`, {
      credentials: 'include',
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error('Unable to prepare a secure request.');
      }

      const { csrfToken } = await response.json();
      if (!csrfToken) {
        throw new Error('Unable to prepare a secure request.');
      }

      return csrfToken;
    }).catch((error) => {
      csrfTokenRequest = null;
      throw error;
    });
  }

  return csrfTokenRequest;
};

const withCsrfToken = (headers, csrfToken) => ({
  ...(headers || {}),
  'x-csrf-token': csrfToken,
});

export const lcFetch = async (url, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  const csrfToken = UNSAFE_METHODS.has(method) ? await requestCsrfToken() : null;

  return fetch(`${apiOrigin}${url}`, {
    ...options,
    credentials: 'include',
    ...(csrfToken ? { headers: withCsrfToken(options.headers, csrfToken) } : {}),
  });
};
