/* eslint-env jest */

const mockQuery = jest.fn();

jest.mock('./index', () => ({
  pool: { query: mockQuery },
}));

jest.mock('letscube-scrambles', () => ({
  generateScramble: jest.fn(),
}));

const { listActiveParticipants } = require('./sqlRoomModel');

describe('SQL room presence queries', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('loads only the fields needed to reconcile active participants', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        { room_id: 'room-one', user_id: 101, presence_revision: 4 },
        { room_id: 'room-one', user_id: 202, presence_revision: null },
      ],
    });

    await expect(listActiveParticipants()).resolves.toEqual([
      { roomId: 'room-one', userId: 101, presenceRevision: 4 },
      { roomId: 'room-one', userId: 202, presenceRevision: 0 },
    ]);

    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE rp.in_room = true'));
    expect(mockQuery.mock.calls[0][0]).not.toContain('race_sessions');
  });
});
