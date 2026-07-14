/** @jest-environment node */
/* eslint-env jest */

const { purgeUserEmails } = require('./userEmailPurge');

const runPurge = async ({ matchedCount, modifiedCount, postgresCleared }) => {
  const mongoUsers = {
    updateMany: jest.fn().mockResolvedValue({ matchedCount, modifiedCount }),
    countDocuments: jest.fn().mockResolvedValue(0),
  };
  const postgresClient = {
    query: jest.fn()
      .mockResolvedValueOnce({ rowCount: postgresCleared })
      .mockResolvedValueOnce({ rows: [{ remaining: 0 }] }),
  };
  const report = jest.fn();
  const summary = await purgeUserEmails({ mongoUsers, postgresClient, report });

  return {
    mongoUsers, postgresClient, report, summary,
  };
};

describe('user email purge', () => {
  it('removes every MongoDB field and clears every PostgreSQL copy', async () => {
    const {
      mongoUsers, postgresClient, report, summary,
    } = await runPurge({ matchedCount: 4, modifiedCount: 4, postgresCleared: 4 });

    expect(mongoUsers.updateMany).toHaveBeenCalledWith(
      { email: { $exists: true } },
      { $unset: { email: '' } },
    );
    expect(postgresClient.query).toHaveBeenNthCalledWith(
      1,
      'UPDATE app.users SET email = NULL WHERE email IS NOT NULL',
    );
    expect(summary).toEqual({
      mongoMatched: 4,
      mongoModified: 4,
      mongoRemaining: 0,
      postgresCleared: 4,
      postgresRemaining: 0,
    });
    expect(report).toHaveBeenCalledWith(summary);
  });

  it('is idempotent and reports zero changes on a rerun', async () => {
    const { summary } = await runPurge({
      matchedCount: 0,
      modifiedCount: 0,
      postgresCleared: 0,
    });

    expect(summary).toEqual(expect.objectContaining({
      mongoMatched: 0,
      mongoModified: 0,
      postgresCleared: 0,
    }));
  });

  it('fails when either data store still contains a value', async () => {
    const mongoUsers = {
      updateMany: jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 0 }),
      countDocuments: jest.fn().mockResolvedValue(1),
    };
    const postgresClient = {
      query: jest.fn()
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ remaining: 0 }] }),
    };

    await expect(purgeUserEmails({ mongoUsers, postgresClient }))
      .rejects.toThrow('User email purge verification failed');
  });
});
