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
  });

  it('creates a room, reloads it directly, and lists it in the lobby', () => {
    const roomName = `Cypress Room ${Date.now()}`;
    login();

    cy.visit('/');

    cy.contains('Create Room', { timeout: 10000 }).click();
    cy.get('#roomName').type(roomName);
    cy.get('[role="dialog"]').contains('button', 'Create').click();

    cy.location('pathname', { timeout: 10000 }).should('match', /^\/rooms\/[a-f0-9]+$/);
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
    cy.get('button[aria-label="accept friend request"]').click();

    loginAs(requesterId);
    cy.visit('/notifications');
    cy.contains('accepted your friend request.', { timeout: 10000 }).should('be.visible');
  });
});
