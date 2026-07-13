/** @jest-environment node */
/* eslint-env jest */

jest.mock('../postgres/dualWrite', () => ({ mirrorUser: jest.fn() }));

const mongoose = require('mongoose');
const UserSchema = require('./user');

const User = mongoose.models.UserPrivacyTest
  || mongoose.model('UserPrivacyTest', UserSchema);

describe('user privacy', () => {
  it('does not define or serialize an email field', () => {
    const user = new User({
      id: 1234,
      name: 'Test Solver',
      accessToken: 'oauth-token',
      showWCAID: true,
    });
    user.set('email', 'historical@example.com', { strict: false });

    expect(UserSchema.path('email')).toBeUndefined();
    expect(user.toObject()).not.toHaveProperty('email');
    expect(user.toJSON()).not.toHaveProperty('email');
    expect(user.toObject()).not.toHaveProperty('accessToken');
  });
});

describe('user username schema', () => {
  it('declares an explicit sparse unique normalized username index', () => {
    expect(UserSchema.indexes()).toContainEqual([
      { usernameNormalized: 1 },
      expect.objectContaining({
        name: 'users_username_normalized_unique',
        sparse: true,
        unique: true,
      }),
    ]);
    expect(UserSchema.options.autoIndex).toBe(false);
  });

  it('normalizes direct username writes through the shared validation path', async () => {
    const user = new User({
      id: 1,
      name: 'Test User',
      accessToken: 'secret',
      username: '  MixedCase_1 ',
    });

    await user.validate();

    expect(user.username).toBe('MixedCase_1');
    expect(user.usernameNormalized).toBe('mixedcase_1');
    expect(user.toObject()).not.toHaveProperty('usernameNormalized');
  });

  it('rejects invalid direct username writes', async () => {
    const user = new User({
      id: 1,
      name: 'Test User',
      accessToken: 'secret',
      username: 'not.an.email@example.com',
    });

    await expect(user.validate()).rejects.toMatchObject({
      code: 'INVALID_USERNAME',
      statusCode: 400,
    });
  });
});
