/** @jest-environment node */
/* eslint-env jest */

const { upsertTestUser } = require('./testUser');

describe('Cypress test authentication user', () => {
  it('writes the normalized username explicitly through findOneAndUpdate', async () => {
    const saved = { id: 990001 };
    const User = { findOneAndUpdate: jest.fn().mockResolvedValue(saved) };

    await expect(upsertTestUser(User, {
      code: 'test-code',
      userId: 990001,
    })).resolves.toBe(saved);

    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { id: 990001 },
      expect.objectContaining({
        id: 990001,
        username: 'cypress',
        usernameNormalized: 'cypress',
      }),
      {
        upsert: true,
        useFindAndModify: false,
        new: true,
      },
    );
  });
});
