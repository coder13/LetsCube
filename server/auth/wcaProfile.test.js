/** @jest-environment node */
/* eslint-env jest */

const { buildWcaUserUpdate } = require('./wcaProfile');

describe('WCA profile ingestion', () => {
  it('allowlists the identity fields used by LetsCube', () => {
    const update = buildWcaUserUpdate({
      id: '1234',
      name: 'Test Solver',
      wca_id: '2026TEST01',
      avatar: { thumb_url: 'avatar.png' },
      email: 'private@example.com',
      dob: '2000-01-01',
      unrecognized_field: 'do not retain',
    }, 'oauth-token');

    expect(update).toEqual({
      id: 1234,
      name: 'Test Solver',
      wcaId: '2026TEST01',
      accessToken: 'oauth-token',
      avatar: { thumb_url: 'avatar.png' },
    });
    expect(update).not.toHaveProperty('email');
    expect(update).not.toHaveProperty('dob');
  });
});
