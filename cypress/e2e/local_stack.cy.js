describe('local app stack', () => {
  const login = () => {
    cy.request('POST', 'http://localhost:8080/auth/code', {
      code: 'cypress-test-code',
      redirectUri: 'http://localhost:3000/wca-redirect',
    });
  };

  it('shows the lobby without a logged-in session', () => {
    cy.visit('/');

    cy.contains('Public Rooms', { timeout: 10000 }).should('exist');
    cy.contains('Private Rooms').should('exist');
    cy.contains('Create Room').should('not.exist');

    cy.request({
      url: 'http://localhost:8080/api/me',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(403);
      expect(response.body).to.eq('{"code":403,"message":"Unauthorized"}');
    });
  });

  it('logs in and exposes the test user through the API', () => {
    login();

    cy.request('http://localhost:8080/api/me').then((response) => {
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
});
