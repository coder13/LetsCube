const notificationPresentation = (notification) => {
  const actorName = notification.actor
    && (notification.actor.displayName || notification.actor.username)
    ? notification.actor.displayName || notification.actor.username : 'A user';
  switch (notification.type) {
    case 'friend_request':
      return {
        actions: ['accept', 'decline'],
        text: `${actorName} sent you a friend request.`,
      };
    case 'friend_request_accepted':
      return { actions: [], text: `${actorName} accepted your friend request.` };
    case 'room_invitation':
      return { actions: [], text: `${actorName} invited you to a room.` };
    default:
      return { actions: [], text: 'You have a notification from Let\'s Cube.' };
  }
};

export default notificationPresentation;
