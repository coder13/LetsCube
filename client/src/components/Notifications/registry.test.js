import notificationPresentation from './registry';

describe('notification registry', () => {
  it('maps only registered friend resources to typed actions', () => {
    expect(notificationPresentation({
      actor: { username: 'solver' }, type: 'friend_request',
    })).toEqual({
      actions: ['accept', 'decline'],
      text: 'solver sent you a friend request.',
    });
  });

  it('renders unknown notification types without accepting server callbacks', () => {
    const presentation = notificationPresentation({ type: 'unknown_future_type' });

    expect(presentation.actions).toEqual([]);
    expect(presentation).not.toHaveProperty('url');
    expect(presentation).not.toHaveProperty('callback');
  });

  it('maps a typed room invitation to an explicit join action', () => {
    expect(notificationPresentation({
      actor: { username: 'solver' }, type: 'room_invitation',
    })).toEqual({
      actions: ['join race'],
      text: 'solver invited you to race.',
    });
  });
});
