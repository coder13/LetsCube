/** @jest-environment node */
/* eslint-env jest */

const { planUsernameBackfill } = require('./usernameBackfill');

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
    ];

    const { operations, report } = planUsernameBackfill(users);
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
    ]);
    expect(JSON.stringify(report.invalid)).not.toContain('private@example.com');
  });

  it('is idempotent after applying the planned operations', () => {
    const users = [
      { _id: '1', id: 1, username: '  SoloCuber ' },
      { _id: '2', id: 2, username: 'FastCuber' },
      { _id: '3', id: 3, username: 'fastcuber' },
      { _id: '4', id: 4, username: 'legacy.name' },
      { _id: '5', id: 5, username: 'private@example.com' },
    ];
    const first = planUsernameBackfill(users);
    applyOperations(users, first.operations);

    expect(planUsernameBackfill(users).operations).toEqual([]);
  });
});
