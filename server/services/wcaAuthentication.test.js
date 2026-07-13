/* eslint-env jest */

jest.mock('../models', () => ({
  User: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

const { User } = require('../models');
const { persistWcaProfile } = require('./wcaAuthentication');

const profile = {
  id: 1234,
  name: 'Named User',
  email: 'solver@example.com',
  wca_id: '2020TEST01',
  avatar: { url: 'avatar.png' },
};

describe('WCA profile persistence', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates a normal account from its WCA profile', async () => {
    const updatedUser = { id: 1234 };
    User.findOne.mockResolvedValue(null);
    User.findOneAndUpdate.mockResolvedValue(updatedUser);

    await expect(persistWcaProfile({ profile, accessToken: 'secret' }))
      .resolves.toBe(updatedUser);
    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { id: 1234 },
      expect.objectContaining({
        name: profile.name,
        email: profile.email,
        wcaId: profile.wca_id,
        accessToken: 'secret',
      }),
      expect.objectContaining({ upsert: true, new: true }),
    );
  });

  it('does not restore identity or retain a token for an anonymized account', async () => {
    const anonymizedUser = { id: 1234, anonymizedAt: new Date() };
    User.findOne.mockResolvedValue(anonymizedUser);

    await expect(persistWcaProfile({ profile, accessToken: 'new-secret' }))
      .resolves.toBe(anonymizedUser);
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does not win a race with concurrent anonymization', async () => {
    const normalUser = { id: 1234 };
    const anonymizedUser = { id: 1234, anonymizedAt: new Date() };
    User.findOne
      .mockResolvedValueOnce(normalUser)
      .mockResolvedValueOnce(anonymizedUser);
    User.findOneAndUpdate.mockResolvedValue(null);

    await expect(persistWcaProfile({ profile, accessToken: 'new-secret' }))
      .resolves.toBe(anonymizedUser);
    expect(User.findOneAndUpdate.mock.calls[0][0]).toEqual({
      id: 1234,
      anonymizedAt: { $exists: false },
    });
  });
});
