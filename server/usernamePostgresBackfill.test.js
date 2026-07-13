/** @jest-environment node */
/* eslint-env jest */

const { reconcilePostgresUsernames } = require('./usernamePostgresBackfill');

describe('PostgreSQL username reconciliation', () => {
  it('reconciles canonical targets by WCA user ID without raw-value matching', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rowCount: 2 })
        .mockResolvedValueOnce({ rows: [{ remaining: 0 }] }),
    };
    const users = [
      { wcaUserId: 1, username: 'Cuber', usernameNormalized: 'cuber' },
      { wcaUserId: 2, username: undefined, usernameNormalized: undefined },
    ];

    await expect(reconcilePostgresUsernames({ client, users })).resolves.toEqual({
      considered: 2,
      modified: 2,
      remaining: 0,
    });

    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query.mock.calls[0][0]).toContain('wca_user_id');
    expect(client.query.mock.calls[0][0]).not.toContain('LIKE');
    expect(client.query.mock.calls[0][1]).toEqual([1, 'Cuber', 'cuber', 2, null, null]);
    expect(client.query.mock.calls[1][0]).toContain('IS DISTINCT FROM');
  });

  it('is idempotent when PostgreSQL already matches MongoDB targets', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ remaining: 0 }] }),
    };

    await expect(reconcilePostgresUsernames({
      client,
      users: [{ wcaUserId: 1, username: 'Cuber', usernameNormalized: 'cuber' }],
    })).resolves.toMatchObject({ modified: 0, remaining: 0 });
  });

  it('fails closed when exact post-update verification finds a mismatch', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ remaining: 1 }] }),
    };

    await expect(reconcilePostgresUsernames({
      client,
      users: [{ wcaUserId: 2, username: undefined, usernameNormalized: undefined }],
    })).rejects.toThrow('PostgreSQL username reconciliation verification failed');
  });

  it('fails closed instead of skipping a target without a WCA user ID', async () => {
    const client = { query: jest.fn() };

    await expect(reconcilePostgresUsernames({
      client,
      users: [{ wcaUserId: undefined, username: 'orphan', usernameNormalized: 'orphan' }],
    })).rejects.toThrow('requires a valid WCA user ID');
    expect(client.query).not.toHaveBeenCalled();
  });
});
