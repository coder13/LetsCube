import { getWcaAuthorizationUrl, WCA_OAUTH_SCOPE } from './wcaAuth';

describe('WCA authorization request', () => {
  it('requests only the public identity scope', () => {
    const url = new URL(getWcaAuthorizationUrl({
      origin: 'https://www.worldcubeassociation.org',
      clientId: 'client-id',
      redirectUri: 'https://letscube.net/wca-redirect',
    }));

    expect(WCA_OAUTH_SCOPE).toBe('public');
    expect(url.searchParams.get('scope')).toBe('public');
    expect(url.searchParams.get('scope')).not.toMatch(/dob|email/);
  });
});
