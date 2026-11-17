/** @jest-environment node */
/* eslint-env jest */

const mockQuery = jest.fn();
const mockOn = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    on: mockOn,
    query: mockQuery,
  })),
}));
jest.mock('../runtimeConfig', () => ({
  postgres: {
    enabled: true,
    connectionString: 'postgres://test',
    ssl: false,
  },
}));
jest.mock('../logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
}));

const { deleteExpiredSessions } = require('./index');

describe('PostgreSQL maintenance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
  });

  it('deletes expired sessions in bounded batches until the backlog is clear', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 10_000 })
      .mockResolvedValueOnce({ rowCount: 4 });

    await expect(deleteExpiredSessions()).resolves.toBe(10_004);

    expect(mockQuery).toHaveBeenCalledTimes(3);
    expect(mockQuery.mock.calls[1][0]).toContain('WHERE expire <= now()');
    expect(mockQuery.mock.calls[1][0]).toContain('LIMIT $1');
    expect(mockQuery.mock.calls[1][0]).toContain('FOR UPDATE SKIP LOCKED');
    expect(mockQuery.mock.calls[1][1]).toEqual([10_000]);
  });
});
