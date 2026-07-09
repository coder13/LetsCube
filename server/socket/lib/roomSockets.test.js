/* eslint-env jest */

const { removeUserFromRoomSockets } = require('./roomSockets');

describe('removeUserFromRoomSockets', () => {
  it('uses Socket.IO 4 socketsLeave for every socket in the user-room', () => {
    const socketsLeave = jest.fn();
    const inRoom = jest.fn(() => ({ socketsLeave }));
    const namespace = { in: inRoom };
    const room = { _id: 'room-123', accessCode: 'access-123' };

    removeUserFromRoomSockets(namespace, 101, room);

    expect(inRoom).toHaveBeenCalledWith('user-room/101-room-123');
    expect(socketsLeave).toHaveBeenCalledWith([
      'access-123',
      'user-room/101-room-123',
    ]);
  });
});
