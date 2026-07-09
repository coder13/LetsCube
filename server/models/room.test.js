/** @jest-environment node */
/* eslint-env jest */

const bcrypt = require('bcrypt');
const { Room } = require('./room');

describe('room security helpers', () => {
  it('authenticates passwords asynchronously', async () => {
    const password = 'correct horse battery staple';
    const room = {
      password: await bcrypt.hash(password, 4),
    };

    await expect(Room.methods.authenticate.call(room, password)).resolves.toBe(true);
    await expect(Room.methods.authenticate.call(room, 'incorrect')).resolves.toBe(false);
    await expect(Room.methods.authenticate.call({ password: null }, password)).resolves.toBe(false);
  });

  it('hashes private room passwords with the configured work factor', async () => {
    const room = {
      save: jest.fn().mockResolvedValue(undefined),
    };

    await Room.methods.edit.call(room, {
      name: 'Private room',
      private: true,
      password: 'secret',
      type: 'normal',
      requireRevealedIdentity: false,
      startTime: null,
    });

    expect(room.password).not.toBe('secret');
    expect(bcrypt.getRounds(room.password)).toBe(10);
    await expect(bcrypt.compare('secret', room.password)).resolves.toBe(true);
    expect(room.save).toHaveBeenCalledTimes(1);
  });

  it('marks stale rooms for expiration in ten minutes', async () => {
    const before = Date.now();
    const room = {
      save: jest.fn().mockResolvedValue(undefined),
    };

    await Room.methods.updateStale.call(room, true);

    expect(room.expireAt).toBeInstanceOf(Date);
    expect(room.expireAt.getTime()).toBeGreaterThanOrEqual(before + 10 * 60 * 1000);
    expect(room.expireAt.getTime()).toBeLessThanOrEqual(Date.now() + 10 * 60 * 1000);
  });
});
