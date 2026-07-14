/** @jest-environment node */
/* eslint-env jest */

const { createRaceInvitationService } = require('./raceInvitationService');

describe('race invitation service', () => {
  it('authorizes an accepted friend and creates a typed invitation', async () => {
    const recipient = { id: 2, username: 'guest' };
    const relationships = {
      requireAcceptedFriend: jest.fn().mockResolvedValue(recipient),
    };
    const notifications = { createRoomInvitation: jest.fn().mockResolvedValue({ created: true }) };
    const service = createRaceInvitationService({ notifications, relationships });
    const actor = { id: 1, username: 'host' };
    const room = { _id: 'room-1' };

    await expect(service.authorize(actor, 2)).resolves.toBe(recipient);
    await service.invite({ actor, recipient, room });

    expect(relationships.requireAcceptedFriend).toHaveBeenCalledWith(actor, 2);
    expect(notifications.createRoomInvitation).toHaveBeenCalledWith({ actor, recipient, room });
  });
});
