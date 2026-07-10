describe('local app stack', () => {
  const apiOrigin = Cypress.env('apiOrigin') || 'http://localhost:8080';

  const login = () => {
    cy.request('POST', `${apiOrigin}/auth/code`, {
      code: 'cypress-test-code',
      redirectUri: 'http://localhost:3000/wca-redirect',
    });
  };

  const loginAs = (userId) => {
    cy.request('POST', `${apiOrigin}/auth/code`, {
      code: `cypress-test-user-${userId}`,
      redirectUri: 'http://localhost:3000/wca-redirect',
    });
  };

  it('shows the lobby without a logged-in session', () => {
    cy.visit('/');

    cy.contains('Public Rooms', { timeout: 10000 }).should('exist');
    cy.contains('Private Rooms').should('exist');
    cy.contains('Create Room').should('not.exist');

    cy.request({
      url: `${apiOrigin}/api/me`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(403);
      expect(response.body).to.eq('{"code":403,"message":"Unauthorized"}');
    });
  });

  it('renders markdown announcements in the lobby', () => {
    cy.intercept('GET', '**/api/announcements', '[Docs](https://example.com)').as('announcements');

    cy.visit('/');
    cy.wait('@announcements');

    cy.contains('a', 'Docs')
      .should('have.attr', 'href', 'https://example.com')
      .and('have.attr', 'target', '_blank');
  });

  it('logs in and exposes the test user through the API', () => {
    login();

    cy.request(`${apiOrigin}/api/me`).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.include({ id: 990001, canJoinRoom: true });
      expect(response.body.displayName).to.be.oneOf(['Cypress Test User', 'cypress']);
    });

    cy.visit('/');
    cy.contains('Create Room', { timeout: 10000 }).should('be.visible');
    cy.get('a[href="/users/cypress"]', { timeout: 10000 }).click();
    cy.location('pathname').should('eq', '/users/cypress');
    cy.contains('@cypress').should('be.visible');
    cy.get('[aria-label="Find a cuber by username or visible WCA ID"]').should('not.exist');
  });

  it('opens spacious account navigation', () => {
    login();
    cy.visit('/');

    cy.get('button[aria-label="Open account menu"]').click();
    cy.get('[aria-label="Account navigation"]').contains('Friends').should('be.visible');
    cy.get('[aria-label="Account navigation"]').contains('Profile').should('be.visible');
    cy.get('[aria-label="Account navigation"]').contains('Log out').should('be.visible');
  });

  it('shows a not-found page for an unavailable user profile', () => {
    login();

    cy.visit('/users/not-a-real-cuber');
    cy.contains('404').should('be.visible');
    cy.contains('User not found').should('be.visible');
    cy.get('[aria-label="Find a cuber by username or visible WCA ID"]').should('not.exist');
  });

  it('opens cuber discovery from the Add friend dialog', () => {
    const searchUserId = 990003;

    loginAs(searchUserId);
    login();
    cy.visit('/friends');
    cy.contains('Friends', { timeout: 10000 }).should('be.visible');
    cy.contains('button', 'Add friend').click();
    cy.get('[role="dialog"]').contains('Add friend').should('be.visible');
    cy.get('[role="dialog"] input[aria-label="Find a cuber by username or visible WCA ID"]').type(`cypress-${searchUserId}`);
    cy.get('[role="dialog"]').contains('button', 'Search').click();
    cy.get('[role="dialog"]').contains(`cypress-${searchUserId}`).should('be.visible');
  });

  it('creates a room, reloads it directly, and lists it in the lobby', () => {
    const roomName = `Cypress Room ${Date.now()}`;
    cy.viewport(1280, 720);
    login();

    cy.visit('/');

    cy.contains('Create Room', { timeout: 10000 }).click();
    cy.get('#roomName').type(roomName);
    cy.get('[role="dialog"]').contains('button', 'Create').click();

    cy.location('pathname', { timeout: 10000 }).should('match', /^\/rooms\/[a-f0-9]+$/);
    cy.get('.MuiBottomNavigation-root').should('not.be.visible');
    cy.get('thead tr').first().should('have.css', 'display', 'flex');
    cy.location('pathname').then((pathname) => {
      cy.reload();
      cy.location('pathname', { timeout: 10000 }).should('eq', pathname);
      cy.contains(roomName).should('be.visible');
      cy.contains('Waiting For:').should('be.visible');
    });

    cy.visit('/');
    cy.contains('Public Rooms').should('be.visible');
    cy.contains(roomName).scrollIntoView().should('be.visible');
  });

  it('sends and displays chat messages through the socket server', () => {
    const roomName = `Cypress Chat ${Date.now()}`;
    const message = `Hello from Cypress ${Date.now()}`;
    login();

    cy.visit('/');
    cy.contains('Create Room', { timeout: 10000 }).click();
    cy.get('#roomName').type(roomName);
    cy.get('[role="dialog"]').contains('button', 'Create').click();

    cy.location('pathname', { timeout: 10000 }).should('match', /^\/rooms\/[a-f0-9]+$/);
    cy.contains('Chat', { timeout: 10000 }).should('be.visible');
    cy.get('input[placeholder="Send Message"]').type(`${message}{enter}`);

    cy.contains(message, { timeout: 10000 }).should('be.visible');
  });

  it('delivers and acts on a friend request notification for two users', () => {
    const requesterId = 900000 + (Date.now() % 99999);
    const recipientId = requesterId + 1;

    loginAs(recipientId);
    loginAs(requesterId);
    cy.request('POST', `${apiOrigin}/api/friends/requests`, { userId: recipientId })
      .its('status').should('eq', 201);

    loginAs(recipientId);
    cy.request(`${apiOrigin}/api/notifications`).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.notifications.some((notification) => (
        notification.type === 'friend_request' && notification.actor.id === requesterId
      ))).to.eq(true);
    });

    cy.visit('/');
    cy.get('button[aria-label="Notifications"]').click();
    cy.get('[aria-label="Recent notifications"]').should('be.visible');
    cy.contains('sent you a friend request.').should('be.visible');
    cy.contains('View all notifications').click();
    cy.location('pathname').should('eq', '/notifications');
    cy.get('button[aria-label="accept notification"]').click();

    loginAs(requesterId);
    cy.visit('/notifications');
    cy.contains('accepted your friend request.', { timeout: 10000 }).should('be.visible');
  });

  it('starts a race with an accepted friend and lets them join from the invitation', () => {
    const hostId = 800000 + (Date.now() % 99999);
    const guestId = hostId + 1;

    loginAs(guestId);
    loginAs(hostId);
    cy.request('POST', `${apiOrigin}/api/friends/requests`, { userId: guestId })
      .its('status').should('eq', 201);
    loginAs(guestId);
    cy.request('POST', `${apiOrigin}/api/friends/requests/${hostId}/accept`)
      .its('status').should('eq', 200);

    loginAs(hostId);
    cy.visit('/friends');
    cy.contains(`cypress-${guestId}`, { timeout: 10000 }).parents('li')
      .contains('button', 'Race with me').click();
    cy.location('pathname', { timeout: 10000 }).should('match', /^\/rooms\/[a-f0-9]+$/);

    loginAs(guestId);
    cy.request(`${apiOrigin}/api/notifications`).then((response) => {
      expect(response.body.notifications.some((notification) => (
        notification.type === 'room_invitation' && notification.actor.id === hostId
      ))).to.eq(true);
    });
    cy.visit('/notifications');
    cy.contains('invited you to race.', { timeout: 10000 }).should('be.visible');
    cy.get('button[aria-label="join race notification"]').click();
    cy.location('pathname', { timeout: 10000 }).should('match', /^\/rooms\/[a-f0-9]+$/);
    cy.contains('Waiting For:', { timeout: 10000 }).should('be.visible');
  });
});
