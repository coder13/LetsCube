// const origin = process.env.REACT_APP_API_ORIGIN || '';

export const apiOrigin = process.env.REACT_APP_API_ORIGIN;

const UNSAFE_METHODS = new Set(['DELETE', 'PATCH', 'POST', 'PUT']);
const DEFAULT_TIMEOUT_MS = 15000;
let csrfTokenRequest;

export const fetchWithTimeout = async (url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController();
  const upstreamSignal = options.signal;
  const abortFromUpstream = () => controller.abort(upstreamSignal.reason);
  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      abortFromUpstream();
    } else {
      upstreamSignal.addEventListener('abort', abortFromUpstream, { once: true });
    }
  }
  const timeout = setTimeout(() => {
    controller.abort(new Error('Request timed out.'));
  }, timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    if (upstreamSignal) {
      upstreamSignal.removeEventListener('abort', abortFromUpstream);
    }
  }
};

const requestCsrfToken = async () => {
  if (!csrfTokenRequest) {
    csrfTokenRequest = fetchWithTimeout(`${apiOrigin}/api/csrf-token`, {
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

  return fetchWithTimeout(`${apiOrigin}${url}`, {
    ...options,
    credentials: 'include',
    ...(csrfToken ? { headers: withCsrfToken(options.headers, csrfToken) } : {}),
  });
};
