/* eslint-env jest */

const { canDeleteRoom } = require('./roomAuthorization');

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
});
