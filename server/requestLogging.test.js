/* eslint-env jest */

const { isUserApiRequest } = require('./requestLogging');

describe('request logging privacy', () => {
  it('suppresses every users API route, including paths containing email-like input', () => {
    expect(isUserApiRequest({ path: '/api/users/search' })).toBe(true);
    expect(isUserApiRequest({ path: '/api/users/name%40example.com' })).toBe(true);
    expect(isUserApiRequest({ path: '/api/users/visible-cuber' })).toBe(true);
  });

  it('does not suppress unrelated API requests', () => {
    expect(isUserApiRequest({ path: '/api/friends' })).toBe(false);
  });
});
