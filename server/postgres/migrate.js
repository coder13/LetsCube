const { initializePostgres, pool } = require('./index');

initializePostgres()
  .then((initialized) => {
    if (!initialized) {
      process.exitCode = 1;
    }
  })
  .finally(() => pool.end());
