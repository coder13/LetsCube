/** @jest-environment node */
/* eslint-env jest */

jest.mock('./index', () => ({
  pool: { query: jest.fn() },
}));

const { pool } = require('./index');
const { FriendRelationship, SocialNotification } = require('./sqlSocialModels');

describe('PostgreSQL social notification model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockResolvedValue({ rows: [{ id: 'notification-id' }] });
  });

  it('uses separate UUID and text parameters for notification identifiers', async () => {
    const expiresAt = new Date('2026-07-28T00:00:00.000Z');

    await SocialNotification.create({
      recipientId: 1234,
      actorId: 5678,
      type: 'friend_request',
      sourceType: 'friend_relationship',
      sourceId: 'relationship-1',
      dedupeKey: 'friend_request:relationship-1',
      expiresAt,
    });

    const [sql, values] = pool.query.mock.calls[0];
    expect(sql).toContain(') VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())');
    expect(values).toHaveLength(9);
    expect(values[0]).toEqual(expect.any(String));
    expect(values[1]).toBe(values[0]);
    expect(values.slice(2)).toEqual([
      1234,
      5678,
      'friend_request',
      'friend_relationship',
      'relationship-1',
      'friend_request:relationship-1',
      expiresAt,
    ]);
  });

  it('does not use the read-query alias in relationship updates', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'relationship-id' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'relationship-id' }] });

    await FriendRelationship.findOneAndUpdate(
      { _id: 'relationship-id', revision: 1 },
      { $set: { status: 'accepted' }, $inc: { revision: 1 } },
    );

    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain('UPDATE app.friend_relationships');
    expect(sql).toContain('WHERE id = $2::uuid AND revision = $3');
    expect(sql).not.toContain('fr.id');
    expect(sql).not.toContain('fr.revision');
  });
});
