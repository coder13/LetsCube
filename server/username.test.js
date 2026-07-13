/** @jest-environment node */
/* eslint-env jest */

const {
  findUserByUsername,
  normalizeUsername,
  searchUsersByUsernamePrefix,
  updateUsername,
} = require('./username');

describe('username normalization and lookup', () => {
  it('trims display values, preserves casing, and creates a lowercase key', () => {
    expect(normalizeUsername('  FastCuber_7  ')).toEqual({
      username: 'FastCuber_7',
      usernameNormalized: 'fastcuber_7',
    });
  });

  it('represents empty optional usernames as absent fields', () => {
    expect(normalizeUsername('   ')).toEqual({
      username: undefined,
      usernameNormalized: undefined,
    });
  });

  it.each([
    'cuber.name',
    'cuber+name',
    'cuber@example.com',
    'two cubers',
    '1234567890123456',
  ])('rejects invalid input without treating it as a lookup: %s', (username) => {
    expect(() => normalizeUsername(username)).toThrow(expect.objectContaining({
      code: 'INVALID_USERNAME',
      statusCode: 400,
    }));
  });

  it('uses normalized equality instead of a regular expression for exact lookup', () => {
    const User = { findOne: jest.fn().mockReturnValue('query') };

    expect(findUserByUsername(User, 'Cuber_1')).toBe('query');
    expect(User.findOne).toHaveBeenCalledWith({ usernameNormalized: 'cuber_1' });
  });

  it('uses an indexed lexical range and caps prefix results', () => {
    const limit = jest.fn().mockReturnValue('query');
    const sort = jest.fn().mockReturnValue({ limit });
    const User = { find: jest.fn().mockReturnValue({ sort }) };

    expect(searchUsersByUsernamePrefix(User, 'CuBer', 1000)).toBe('query');
    expect(User.find).toHaveBeenCalledWith({
      usernameNormalized: {
        $gte: 'cuber',
        $lt: 'cuber\uffff',
      },
    });
    expect(sort).toHaveBeenCalledWith({ usernameNormalized: 1 });
    expect(limit).toHaveBeenCalledWith(50);
  });

  it('rejects metacharacters before issuing a prefix query', () => {
    const User = { find: jest.fn() };

    expect(() => searchUsersByUsernamePrefix(User, 'cube.*')).toThrow(expect.objectContaining({
      code: 'INVALID_USERNAME',
    }));
    expect(User.find).not.toHaveBeenCalled();
  });
});

describe('username updates', () => {
  it('saves normalized fields and allows display casing changes for the same user', async () => {
    const saved = { toObject: jest.fn() };
    const user = { id: 1, save: jest.fn().mockResolvedValue(saved) };
    const User = { findOne: jest.fn().mockResolvedValue({ id: 1 }) };

    await expect(updateUsername(User, user, '  Cuber  ')).resolves.toBe(saved);
    expect(user).toEqual(expect.objectContaining({
      username: 'Cuber',
      usernameNormalized: 'cuber',
    }));
  });

  it('returns a stable conflict before writing another user\'s username', async () => {
    const user = { id: 1, save: jest.fn() };
    const User = { findOne: jest.fn().mockResolvedValue({ id: 2 }) };

    await expect(updateUsername(User, user, 'Cuber')).rejects.toMatchObject({
      code: 'USERNAME_TAKEN',
      statusCode: 409,
    });
    expect(user.save).not.toHaveBeenCalled();
  });

  it('maps a unique-index race to the same stable conflict', async () => {
    const duplicate = Object.assign(new Error('users_username_normalized_unique'), { code: 11000 });
    const user = { id: 1, save: jest.fn().mockRejectedValue(duplicate) };
    const User = { findOne: jest.fn().mockResolvedValue(null) };

    await expect(updateUsername(User, user, 'Cuber')).rejects.toMatchObject({
      code: 'USERNAME_TAKEN',
      statusCode: 409,
    });
  });

  it('unsets an optional username without querying for a conflict', async () => {
    const user = { id: 1, username: 'Old', usernameNormalized: 'old' };
    user.save = jest.fn().mockResolvedValue(user);
    const User = { findOne: jest.fn() };

    await updateUsername(User, user, '');

    expect(user.username).toBeUndefined();
    expect(user.usernameNormalized).toBeUndefined();
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it('returns a stable error when the request omits username', async () => {
    await expect(updateUsername({}, { id: 1 }, undefined)).rejects.toMatchObject({
      code: 'MISSING_USERNAME',
      statusCode: 400,
    });
  });
});
