const purgeUserEmails = async ({ mongoUsers, postgresClient, report = () => {} }) => {
  const mongoResult = await mongoUsers.updateMany(
    { email: { $exists: true } },
    { $unset: { email: '' } },
  );
  const mongoRemaining = await mongoUsers.countDocuments({ email: { $exists: true } });

  const postgresResult = await postgresClient.query(
    'UPDATE app.users SET email = NULL WHERE email IS NOT NULL',
  );
  const postgresVerification = await postgresClient.query(
    'SELECT count(*)::int AS remaining FROM app.users WHERE email IS NOT NULL',
  );

  const summary = {
    mongoMatched: mongoResult.matchedCount,
    mongoModified: mongoResult.modifiedCount,
    mongoRemaining,
    postgresCleared: postgresResult.rowCount,
    postgresRemaining: postgresVerification.rows[0].remaining,
  };
  report(summary);

  if (mongoRemaining !== 0 || summary.postgresRemaining !== 0) {
    throw new Error('User email purge verification failed');
  }

  return summary;
};

module.exports = {
  purgeUserEmails,
};
