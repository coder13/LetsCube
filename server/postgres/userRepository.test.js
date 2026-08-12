/** @jest-environment node */

jest.mock('./index', () => ({
  pool: {
    query: jest.fn(),
  },
}));
jest.mock('./dualWrite', () => ({
  stableId: jest.fn(() => 'stable-user-id'),
}));

const { pool } = require('./index');
const { updateUser } = require('./userRepository');

describe('PostgreSQL user repository', () => {
  it('keeps a legacy non-ASCII username during a profile update', async () => {
    pool.query.mockResolvedValue({
      rows: [{
        id: 'stable-user-id',
        wca_user_id: 2022,
        name: 'Alessandro van Burken',
        username: 'Αλέξανδρος',
        username_normalized: null,
        preferences: {},
        avatar: {},
      }],
    });

    await expect(updateUser({
      id: 2022,
      name: 'Alessandro van Burken',
      username: 'Αλέξανδρος',
    })).resolves.toMatchObject({
      username: 'Αλέξανδρος',
      usernameNormalized: undefined,
    });

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('username_normalized'),
      expect.arrayContaining(['Αλέξανδρος', null]),
    );
  });
});
