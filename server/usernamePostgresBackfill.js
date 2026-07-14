const DEFAULT_BATCH_SIZE = 500;

const validUser = ({ wcaUserId }) => {
  const id = Number(wcaUserId);
  return Number.isSafeInteger(id) && id > 0;
};

const expectedValues = (users) => users.flatMap((user) => [
  Number(user.wcaUserId),
  user.username || null,
  user.usernameNormalized || null,
]);

const expectedRows = (users) => users.map((user, index) => {
  const offset = index * 3;
  return `($${offset + 1}::bigint, $${offset + 2}::text, $${offset + 3}::text)`;
}).join(', ');

const reconcileBatch = async (client, users) => {
  const values = expectedValues(users);
  const rows = expectedRows(users);
  const updated = await client.query(`
    WITH expected(wca_user_id, username, username_normalized) AS (
      VALUES ${rows}
    )
    UPDATE app.users AS users
    SET username = expected.username,
        username_normalized = expected.username_normalized,
        ingested_at = now()
    FROM expected
    WHERE users.wca_user_id = expected.wca_user_id
      AND ROW(users.username, users.username_normalized)
        IS DISTINCT FROM ROW(expected.username, expected.username_normalized)
  `, values);
  const verification = await client.query(`
    WITH expected(wca_user_id, username, username_normalized) AS (
      VALUES ${rows}
    )
    SELECT count(*)::int AS remaining
    FROM app.users AS users
    JOIN expected USING (wca_user_id)
    WHERE ROW(users.username, users.username_normalized)
      IS DISTINCT FROM ROW(expected.username, expected.username_normalized)
  `, values);

  return {
    modified: updated.rowCount,
    remaining: verification.rows[0].remaining,
  };
};

const reconcilePostgresUsernames = async ({
  client,
  users,
  batchSize = DEFAULT_BATCH_SIZE,
}) => {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error('PostgreSQL username reconciliation requires a positive batch size');
  }
  const eligibleUsers = users.filter(validUser);
  if (eligibleUsers.length !== users.length) {
    throw new Error('PostgreSQL username reconciliation requires a valid WCA user ID');
  }
  const batches = Array.from(
    { length: Math.ceil(eligibleUsers.length / batchSize) },
    (unused, index) => eligibleUsers.slice(index * batchSize, (index + 1) * batchSize),
  );

  const summary = await batches.reduce(async (previous, batch) => {
    const accumulated = await previous;
    const result = await reconcileBatch(client, batch);
    return {
      modified: accumulated.modified + result.modified,
      remaining: accumulated.remaining + result.remaining,
    };
  }, Promise.resolve({ modified: 0, remaining: 0 }));

  if (summary.remaining) {
    throw new Error('PostgreSQL username reconciliation verification failed');
  }

  return {
    considered: eligibleUsers.length,
    ...summary,
  };
};

module.exports = {
  reconcilePostgresUsernames,
};
