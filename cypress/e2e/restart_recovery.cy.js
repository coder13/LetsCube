describe('service restart recovery', () => {
  const appOrigin = Cypress.config('baseUrl') || 'http://localhost:3000';

  const post = (url, body) => cy.request(`${appOrigin}/api/csrf-token`)
    .then(({ body: { csrfToken } }) => cy.request({
      body,
      headers: { 'x-csrf-token': csrfToken },
      method: 'POST',
      url,
    }));

  const login = () => {
    post(`${appOrigin}/auth/code`, {
      code: 'cypress-test-code',
      redirectUri: 'http://localhost:3000/wca-redirect',
    });
    cy.request(`${appOrigin}/api/me`).its('body.id').should('eq', 990001);
  };

  beforeEach(() => {
    if (!Cypress.env('faultInjection')) {
      cy.log('Fault injection is only enabled in CI.');
      return;
    }
    cy.clearCookies();
  });

  it('keeps the login session when the API restarts', function testApiRestart() {
    if (!Cypress.env('faultInjection')) this.skip();

    login();
    cy.task('restartApi');
    cy.request(`${appOrigin}/api/me`).its('body.id').should('eq', 990001);
  });

  it('rejoins the active room when the socket service restarts', function testSocketRestart() {
    if (!Cypress.env('faultInjection')) this.skip();

    login();
    cy.visit('/');
    cy.contains('Create Room', { timeout: 10000 }).click();
    cy.get('#roomName').type(`Restart Recovery ${Date.now()}`);
    cy.get('[role="dialog"]').contains('button', 'Create').click();

    cy.location('pathname', { timeout: 10000 }).should('match', /^\/rooms\/[0-9a-f-]{36}$/);
    cy.contains('Waiting For:', { timeout: 10000 }).should('be.visible');
    cy.location('pathname').then((pathname) => {
      const message = `Recovered after restart ${Date.now()}`;
      cy.task('restartSocket');
      cy.location('pathname').should('eq', pathname);
      cy.contains('Waiting For:', { timeout: 20000 }).should('be.visible');
      cy.get('input[placeholder="Send Message"]').type(`${message}{enter}`);
      cy.contains(message, { timeout: 20000 }).should('be.visible');
    });
  });
});
