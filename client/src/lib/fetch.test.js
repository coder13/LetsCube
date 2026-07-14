import { lcFetch } from './fetch';

describe('lcFetch', () => {
  beforeEach(() => {
    window.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('adds a server-issued CSRF token to unsafe requests', async () => {
    window.fetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ csrfToken: 'csrf-token' }),
        ok: true,
      })
      .mockResolvedValueOnce({ ok: true });

    await lcFetch('/api/updatePreference', {
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    });

    expect(window.fetch).toHaveBeenNthCalledWith(1, 'undefined/api/csrf-token', {
      credentials: 'include',
    });
    expect(window.fetch).toHaveBeenNthCalledWith(2, 'undefined/api/updatePreference', {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': 'csrf-token',
      },
      method: 'PUT',
    });
  });

  it('does not fetch a CSRF token for safe requests', async () => {
    window.fetch.mockResolvedValue({ ok: true });

    await lcFetch('/api/me');

    expect(window.fetch).toHaveBeenCalledTimes(1);
    expect(window.fetch).toHaveBeenCalledWith('undefined/api/me', {
      credentials: 'include',
    });
  });
});
