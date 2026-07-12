/** @jest-environment node */
/* eslint-env jest */

const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { generateScramble } = require('letscube-scrambles');
const { collectPostgresChanges, Room } = require('./room');

jest.mock('letscube-scrambles', () => ({
  generateScramble: jest.fn(),
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
