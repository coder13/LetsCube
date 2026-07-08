describe('Cypress CI wiring', () => {
  it('runs Cypress specs in CI', () => {
    cy.wrap('letscube').should('equal', 'letscube');
  });
});
