/* eslint-env jest */

const {
  canAccessRoom,
  canDeleteRoom,
  isRoomAdmin,
  isRoomOwner,
} = require('./roomAuthorization');

describe('room roles', () => {
  const room = {
    owner: { id: 101 },
    admin: { id: 202 },
  };

  it('distinguishes the permanent owner from the current admin', () => {
    expect(isRoomOwner('101', room)).toBe(true);
    expect(isRoomOwner(202, room)).toBe(false);
    expect(isRoomAdmin('202', room)).toBe(true);
    expect(isRoomAdmin(101, room)).toBe(false);
  });

  it('rejects missing users, rooms, and role holders', () => {
    expect(isRoomOwner(null, room)).toBe(false);
    expect(isRoomOwner(101, null)).toBe(false);
    expect(isRoomAdmin(202, { ...room, admin: null })).toBe(false);
  });
});

describe('canDeleteRoom', () => {
  const room = {
    owner: { id: 101 },
    admin: { id: 202 },
  };

  it('allows the room owner and current admin', () => {
    expect(canDeleteRoom(101, room)).toBe(true);
    expect(canDeleteRoom('202', room)).toBe(true);
  });

  it('rejects users without authority over the target room', () => {
    expect(canDeleteRoom(303, room)).toBe(false);
    expect(canDeleteRoom(null, room)).toBe(false);
  });

  it('allows the global administrator', () => {
    expect(canDeleteRoom(8184, null)).toBe(true);
  });

  it('keeps absent-owner deletion separate from active host authority', () => {
    const roomWithAbsentOwner = {
      owner: { id: 101 },
      admin: { id: 202 },
      inRoom: new Map([['101', false], ['202', true]]),
      banned: new Map(),
    };

    expect(canDeleteRoom(101, roomWithAbsentOwner)).toBe(true);
    expect(canAccessRoom(101, roomWithAbsentOwner)).toBe(false);
    expect(isRoomAdmin(101, roomWithAbsentOwner)).toBe(false);
  });
});

describe('canAccessRoom', () => {
  const room = ({ inRoom = true, banned = false } = {}) => ({
    inRoom: new Map([['101', inRoom]]),
    banned: new Map([['101', banned]]),
  });

  it('allows anonymous spectators and active room users', () => {
    expect(canAccessRoom(null, room())).toBe(true);
    expect(canAccessRoom(101, room())).toBe(true);
  });

  it('rejects missing rooms, removed users, and banned users', () => {
    expect(canAccessRoom(101, null)).toBe(false);
    expect(canAccessRoom(101, room({ inRoom: false }))).toBe(false);
    expect(canAccessRoom(101, room({ banned: true }))).toBe(false);
  });
});
