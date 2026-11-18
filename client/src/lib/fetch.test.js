import { fetchWithTimeout, lcFetch } from './fetch';

describe('lcFetch', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('adds a server-issued CSRF token to unsafe requests', async () => {
    globalThis.fetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ csrfToken: 'csrf-token' }),
        ok: true,
      })
      .mockResolvedValueOnce({ ok: true });

    await lcFetch('/api/updatePreference', {
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    });

    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      'undefined/api/csrf-token',
      expect.objectContaining({
        credentials: 'include',
        signal: expect.any(AbortSignal),
      }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      'undefined/api/updatePreference',
      expect.objectContaining({
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': 'csrf-token',
        },
        method: 'PUT',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('does not fetch a CSRF token for safe requests', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true });

    await lcFetch('/api/me');

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'undefined/api/me',
      expect.objectContaining({
        credentials: 'include',
        signal: expect.any(AbortSignal),
      }),
    );
  });
});

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('aborts a request after its deadline', async () => {
    globalThis.fetch = jest.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason));
    }));

    const request = fetchWithTimeout('/slow', {}, 5000);
    jest.advanceTimersByTime(5000);

    await expect(request).rejects.toThrow('Request timed out.');
  });

  it('preserves a caller abort signal', async () => {
    const upstream = new AbortController();
    globalThis.fetch = jest.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason));
    }));

    const request = fetchWithTimeout('/cancelled', { signal: upstream.signal });
    upstream.abort(new Error('Caller cancelled.'));

    await expect(request).rejects.toThrow('Caller cancelled.');
  });
});
