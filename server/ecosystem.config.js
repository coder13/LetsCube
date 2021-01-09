module.exports = {
  apps: [{
    name: 'letscube-api',
    script: 'node ./index.js',

    // Options reference: https://pm2.keymetrics.io/docs/usage/application-declaration/
    args: '',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'prod',
    },
  }, {
    name: 'letscube-socket',
    script: 'node ./socket/index.js',

    // Options reference: https://pm2.keymetrics.io/docs/usage/application-declaration/
    args: '',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'prod',
    },
  }],

  deploy: {
    production: {
      user: 'www',
      host: '127.0.0.1',
      ref: 'origin/master',
      repo: 'git@github.com:coder13/letscube',
      path: '/var/www/production',
      'post-deploy': 'cd server && npm install && pm2 reload ecosystem.config.js --env prod',
    },
  },
};
