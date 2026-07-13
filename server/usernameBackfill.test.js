/** @jest-environment node */
/* eslint-env jest */

const {
  assertUsernameRolloutReady,
  planUsernameBackfill,
} = require('./usernameBackfill');
const { normalizeUsername } = require('./username');

const applyOperations = (users, operations) => {
  operations.forEach(({ updateOne }) => {
    const user = users.find(({ _id }) => _id === updateOne.filter._id);
    Object.assign(user, updateOne.update.$set || {});
    Object.keys(updateOne.update.$unset || {}).forEach((key) => delete user[key]);
  });
};

describe('normalized username backfill', () => {
  it('plans valid, empty, invalid, and colliding legacy records safely', () => {
    const users = [
      { _id: '1', id: 1, username: '  SoloCuber ' },
      { _id: '2', id: 2, username: 'FastCuber' },
      {
        _id: '3', id: 3, username: 'fastcuber', usernameNormalized: 'stale',
      },
      { _id: '4', id: 4, username: '' },
      {
        _id: '5', id: 5, username: 'legacy.name', usernameNormalized: 'legacy.name',
      },
      { _id: '6', id: 6, username: 'private@example.com' },
      { _id: '7', id: 7, username: 'private\uFF20example.com' },
      { _id: '8', id: 8, username: 'private\uFE6Bexample.com' },
    ];

    const {
      operations, postgresUsers, report,
    } = planUsernameBackfill(users);
    applyOperations(users, operations);

    expect(users[0]).toMatchObject({
      username: 'SoloCuber', usernameNormalized: 'solocuber',
    });
    expect(users[1].usernameNormalized).toBeUndefined();
    expect(users[2].usernameNormalized).toBeUndefined();
    expect(users[3].username).toBeUndefined();
    expect(users[4]).toMatchObject({ username: 'legacy.name' });
    expect(users[4].usernameNormalized).toBeUndefined();
    expect(users[5].username).toBeUndefined();
    expect(users[6].username).toBeUndefined();
    expect(users[7].username).toBeUndefined();
    expect(report.collisions).toEqual([{
      usernameNormalized: 'fastcuber',
      users: [
        { id: 2, username: 'FastCuber' },
        { id: 3, username: 'fastcuber' },
      ],
    }]);
    expect(report.invalid).toEqual([
      { id: 5, code: 'INVALID_USERNAME' },
      { id: 6, code: 'INVALID_USERNAME' },
      { id: 7, code: 'INVALID_USERNAME' },
      { id: 8, code: 'INVALID_USERNAME' },
    ]);
    expect(report.privacyRemoved).toBe(3);
    expect(JSON.stringify(report.invalid)).not.toContain('private@example.com');
    expect(postgresUsers.slice(5)).toEqual([
      { wcaUserId: 6, username: undefined, usernameNormalized: undefined },
      { wcaUserId: 7, username: undefined, usernameNormalized: undefined },
      { wcaUserId: 8, username: undefined, usernameNormalized: undefined },
    ]);
    expect(JSON.stringify(postgresUsers.slice(5))).not.toContain('private');
  });

  it('is idempotent after applying the planned operations', () => {
    const users = [
      { _id: '1', id: 1, username: '  SoloCuber ' },
      { _id: '2', id: 2, username: 'FastCuber' },
      { _id: '3', id: 3, username: 'fastcuber' },
      { _id: '4', id: 4, username: 'legacy.name' },
      { _id: '5', id: 5, username: 'private@example.com' },
      { _id: '6', id: 6, username: 'private\uFF20example.com' },
      { _id: '7', id: 7, username: 'private\uFE6Bexample.com' },
    ];
    const first = planUsernameBackfill(users);
    applyOperations(users, first.operations);

    expect(planUsernameBackfill(users).operations).toEqual([]);
  });

  it('fails index rollout while any valid collision remains unclaimed', () => {
    const users = [
      { _id: '1', id: 1, username: 'FastCuber' },
      { _id: '2', id: 2, username: 'fastcuber' },
    ];
    const first = planUsernameBackfill(users);
    applyOperations(users, first.operations);
    const verified = planUsernameBackfill(users);

    expect(verified.report.pendingChanges).toBe(0);
    expect(() => assertUsernameRolloutReady(verified.report))
      .toThrow('collision group(s) require resolution');
    expect(normalizeUsername('FASTCUBER').usernameNormalized)
      .toBe(verified.report.collisions[0].usernameNormalized);
  });

  it('allows index rollout only after the verified plan is collision-free', () => {
    const users = [{
      _id: '1', id: 1, username: 'SoloCuber', usernameNormalized: 'solocuber',
    }];
    const { report } = planUsernameBackfill(users);

    expect(() => assertUsernameRolloutReady(report)).not.toThrow();
  });
});
