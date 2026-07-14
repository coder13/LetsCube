/** @jest-environment node */
/* eslint-env jest */

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
