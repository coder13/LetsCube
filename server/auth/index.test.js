/** @jest-environment node */
/* eslint-env jest */

const { deserializeUser } = require('./index');

describe('session user deserialization', () => {
  it('uses the Mongoose promise API and returns the loaded user', async () => {
    const user = { id: 990001 };
    const User = { findOne: jest.fn().mockResolvedValue(user) };
    const done = jest.fn();

    await deserializeUser(User, 990001, done);

    expect(User.findOne).toHaveBeenCalledWith({ id: 990001 });
    expect(done).toHaveBeenCalledWith(null, user);
  });

  it('passes persistence errors to Passport', async () => {
    const error = new Error('database unavailable');
    const User = { findOne: jest.fn().mockRejectedValue(error) };
    const done = jest.fn();

    await deserializeUser(User, 990001, done);

    expect(done).toHaveBeenCalledWith(error);
  });
});
