/** @jest-environment node */
/* eslint-env jest */

const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { generateScramble } = require('letscube-scrambles');
const { mirrorRoomChanges } = require('../postgres/dualWrite');
const {
  collectPostgresChanges,
  Room,
  selectRoomAdmin,
} = require('./room');

jest.mock('letscube-scrambles', () => ({
  generateScramble: jest.fn(),
}));
jest.mock('../postgres/dualWrite', () => ({
  mirrorRoomChanges: jest.fn().mockResolvedValue(undefined),
}));

const RoomModel = mongoose.model('RoomPostgresChangesTest', Room);

describe('room security helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates attempts with the shared async scramble generator', async () => {
    generateScramble.mockResolvedValue('R U R\'');
    const room = {
      event: '333',
      attempts: [],
      usersInRoom: [{ id: 1234 }],
      waitingFor: new Map(),
      competing: new Map([['1234', true]]),
      genAttempt: Room.methods.genAttempt,
      save: jest.fn().mockResolvedValue(undefined),
    };

    await Room.methods.newAttempt.call(room);

    expect(generateScramble).toHaveBeenCalledWith('333');
    expect(room.attempts).toEqual([{
      id: 0,
      scrambles: ['R U R\''],
      results: {},
    }]);
    expect(room.waitingFor.get('1234')).toBe(true);
    expect(room.save).toHaveBeenCalledTimes(1);
  });

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

  it('keeps the existing password when a private room edit leaves it blank', async () => {
    const password = await bcrypt.hash('existing-password', 4);
    const room = {
      password,
      save: jest.fn().mockResolvedValue(undefined),
    };

    await Room.methods.edit.call(room, {
      name: 'Renamed private room',
      private: true,
      password: '',
      type: 'normal',
      requireRevealedIdentity: false,
      startTime: null,
    });

    expect(room.password).toBe(password);
    expect(room.save).toHaveBeenCalledTimes(1);
  });

  it('ignores the access-code placeholder sent by older clients', async () => {
    const password = await bcrypt.hash('existing-password', 4);
    const room = {
      accessCode: 'ROOM-CODE',
      password,
      save: jest.fn().mockResolvedValue(undefined),
    };

    await Room.methods.edit.call(room, {
      name: 'Renamed private room',
      private: true,
      password: 'ROOM-CODE',
      type: 'normal',
      requireRevealedIdentity: false,
      startTime: null,
    });

    expect(room.password).toBe(password);
    expect(room.save).toHaveBeenCalledTimes(1);
  });

  it('requires a password when making a public room private', async () => {
    const room = {
      password: null,
      save: jest.fn().mockResolvedValue(undefined),
    };

    await expect(Room.methods.edit.call(room, {
      name: 'Private room',
      private: true,
      password: undefined,
      type: 'normal',
      requireRevealedIdentity: false,
      startTime: null,
    })).rejects.toMatchObject({
      message: 'A password is required to make a room private',
      statusCode: 400,
    });

    expect(room.save).not.toHaveBeenCalled();
  });

  it('removes the password when making a private room public', async () => {
    const room = {
      password: await bcrypt.hash('existing-password', 4),
      save: jest.fn().mockResolvedValue(undefined),
    };

    await Room.methods.edit.call(room, {
      name: 'Public room',
      private: false,
      password: null,
      type: 'normal',
      requireRevealedIdentity: false,
      startTime: null,
    });

    expect(room.password).toBeNull();
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

  it('restores the owner even when an empty room has no current admin', () => {
    const owner = { id: 101 };
    const earlierParticipant = { id: 202 };

    expect(selectRoomAdmin({
      usersInRoom: [earlierParticipant, owner],
      owner,
      admin: null,
    })).toBe(owner);
  });

  it('keeps an active transferred admin while the owner is absent', () => {
    const earlierParticipant = { id: 202 };
    const transferredAdmin = { id: 303 };

    expect(selectRoomAdmin({
      usersInRoom: [earlierParticipant, transferredAdmin],
      owner: { id: 101 },
      admin: transferredAdmin,
    })).toBe(transferredAdmin);
  });

  it('promotes an active participant when both owner and admin are absent', () => {
    const nextAdmin = { id: 303 };

    expect(selectRoomAdmin({
      usersInRoom: [nextAdmin, { id: 404 }],
      owner: { id: 101 },
      admin: { id: 202 },
    })).toBe(nextAdmin);
  });

  it('clears the admin when the room becomes empty', () => {
    expect(selectRoomAdmin({
      usersInRoom: [],
      owner: { id: 101 },
      admin: { id: 202 },
    })).toBeNull();
  });

  it('hands off and persists admin after a removal without a callback', async () => {
    const owner = { id: 101 };
    const nextAdmin = { id: 202 };
    const persistedAdmins = [];
    const room = {
      owner,
      admin: owner,
      inRoom: new Map([['101', true], ['202', true]]),
      waitingFor: new Map([['101', true], ['202', true]]),
      type: 'grand_prix',
      updateAdminIfNeeded: Room.methods.updateAdminIfNeeded,
      save: jest.fn(async () => {
        persistedAdmins.push(room.admin && room.admin.id);
        return room;
      }),
    };
    Object.defineProperty(room, 'usersInRoom', {
      get: () => [owner, nextAdmin].filter((user) => room.inRoom.get(String(user.id))),
    });

    await Room.methods.dropUser.call(room, owner);

    expect(room.admin).toBe(nextAdmin);
    expect(persistedAdmins).toContain(nextAdmin.id);
  });

  it('persists an empty room without announcing a null admin', async () => {
    const owner = { id: 101 };
    const onAdminChange = jest.fn();
    const room = {
      owner,
      admin: owner,
      inRoom: new Map([['101', true]]),
      waitingFor: new Map([['101', true]]),
      type: 'grand_prix',
      updateAdminIfNeeded: Room.methods.updateAdminIfNeeded,
      save: jest.fn().mockResolvedValue(undefined),
    };
    Object.defineProperty(room, 'usersInRoom', {
      get: () => (room.inRoom.get('101') ? [owner] : []),
    });
    room.save.mockResolvedValue(room);

    await Room.methods.dropUser.call(room, owner, onAdminChange);

    expect(room.admin).toBeNull();
    expect(room.save).toHaveBeenCalled();
    expect(onAdminChange).not.toHaveBeenCalled();
  });

  it('claims a departure with the membership revision compare-and-set', async () => {
    const owner = { id: 101, _id: 'owner-id' };
    const nextAdmin = { id: 202, _id: 'next-admin-id' };
    const updatedRoom = { id: 'room-one' };
    const query = {
      populate: jest.fn(() => query),
      then: (resolve, reject) => Promise.resolve(updatedRoom).then(resolve, reject),
    };
    const model = {
      findOneAndUpdate: jest.fn(() => query),
    };
    const room = {
      _id: 'room-one',
      owner,
      admin: owner,
      users: [owner, nextAdmin],
      inRoom: new Map([['101', true], ['202', true]]),
      type: 'normal',
      membershipRevision: 7,
      constructor: model,
    };

    const departure = await Room.methods.dropUserAtomically.call(room, owner);

    expect(model.findOneAndUpdate).toHaveBeenCalledWith({
      _id: room._id,
      'inRoom.101': true,
      membershipRevision: 7,
    }, {
      $set: {
        'inRoom.101': false,
        'waitingFor.101': false,
        admin: nextAdmin._id,
      },
      $inc: { membershipRevision: 1 },
    }, { new: true });
    expect(departure).toEqual({ room: updatedRoom, adminChanged: true });
    expect(mirrorRoomChanges).toHaveBeenCalledWith(updatedRoom, {
      attempts: [],
      participantUserIds: ['101'],
      syncAllParticipants: false,
      syncRoomOwners: true,
    });
  });

  it('persists and announces the owner reclaiming admin controls', async () => {
    const owner = { id: 101 };
    const room = {
      usersInRoom: [owner, { id: 202 }],
      owner,
      admin: { id: 202 },
      save: jest.fn(),
    };
    room.save.mockResolvedValue(room);
    const onAdminChange = jest.fn();

    await Room.methods.updateAdminIfNeeded.call(room, onAdminChange);

    expect(room.admin).toBe(owner);
    expect(room.save).toHaveBeenCalledTimes(1);
    expect(onAdminChange).toHaveBeenCalledWith(room);
  });

  it('stores an optional result submission id', () => {
    const room = RoomModel.hydrate({
      _id: '507f1f77bcf86cd799439011',
      name: 'Practice room',
      attempts: [{
        id: 0,
        scrambles: ['R U R\''],
        results: {
          1234: {
            time: 12000,
            penalties: {},
            submissionId: 'submission-123',
          },
        },
      }],
    });

    expect(room.attempts[0].results.get('1234').submissionId).toBe('submission-123');
  });

  it('collects only the changed result for incremental PostgreSQL writes', () => {
    const room = RoomModel.hydrate({
      _id: '507f1f77bcf86cd799439011',
      name: 'Practice room',
      event: '333',
      waitingFor: { 1234: true },
      attempts: [{
        _id: '507f1f77bcf86cd799439012',
        id: 0,
        scrambles: ['R U R\''],
        results: {
          1234: {
            _id: '507f1f77bcf86cd799439013',
            time: 12000,
            penalties: {},
          },
        },
      }],
    });
    room.attempts[0].results.set('1234', {
      time: 13000,
      penalties: { AUF: true },
    });
    room.waitingFor.set('1234', false);

    expect(collectPostgresChanges(room)).toEqual({
      attempts: [{
        attemptIndex: 0,
        resultUserIds: ['1234'],
        syncAllResults: false,
      }],
      participantUserIds: ['1234'],
      replaceAttempts: false,
      syncAllParticipants: false,
      syncRoomOwners: false,
    });
  });

  it('replaces PostgreSQL attempts when the room event resets them', () => {
    const room = RoomModel.hydrate({
      _id: '507f1f77bcf86cd799439011',
      name: 'Practice room',
      event: '333',
      attempts: [{
        _id: '507f1f77bcf86cd799439012',
        id: 0,
        scrambles: ['R U R\''],
        results: {},
      }],
    });
    room.event = '222';
    room.attempts = [{
      id: 0,
      scrambles: ['R U2 R\''],
      results: {},
    }];

    expect(collectPostgresChanges(room)).toEqual({
      attempts: [{
        attemptIndex: 0,
        resultUserIds: [],
        syncAllResults: true,
      }],
      participantUserIds: [],
      replaceAttempts: true,
      syncAllParticipants: false,
      syncRoomOwners: false,
    });
  });
});
