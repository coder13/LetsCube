const { defineConfig } = require('cypress');
const { restartService } = require('./cypress/serviceControl');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: false,
    video: false,
    setupNodeEvents(on, config) {
      if (config.env.faultInjection) {
        on('task', {
          restartApi: () => restartService('api'),
          restartSocket: () => restartService('socket'),
        });
      }

      return config;
    },
  },
});
