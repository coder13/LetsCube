const relationshipService = require('./relationshipService');
const notificationService = require('./notificationService');

const createRaceInvitationService = ({
  relationships = relationshipService,
  notifications = notificationService,
} = {}) => ({
  authorize: (actor, recipientId) => relationships.requireAcceptedFriend(actor, recipientId),
  invite: async ({ actor, recipient, room }) => {
    await notifications.createRoomInvitation({ actor, recipient, room });
  },
});

module.exports = {
  createRaceInvitationService,
  ...createRaceInvitationService(),
};
