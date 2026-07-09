describe('local app stack', () => {
  it('logs in and creates a room through the frontend', () => {
    const roomName = `Cypress Room ${Date.now()}`;

    cy.request('POST', 'http://localhost:8080/auth/code', {
      code: 'cypress-test-code',
      redirectUri: 'http://localhost:3000/wca-redirect',
    });

    cy.visit('/');

    cy.contains('Create Room', { timeout: 10000 }).click();
    cy.get('#roomName').type(roomName);
    cy.get('[role="dialog"]').contains('button', 'Create').click();

    cy.location('pathname', { timeout: 10000 }).should('match', /^\/rooms\/[a-f0-9]+$/);
    cy.contains(roomName).should('be.visible');

    cy.visit('/');
    cy.contains('Public Rooms').should('be.visible');
    cy.contains(roomName).should('be.visible');
  });
});
