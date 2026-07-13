/* eslint-env jest */

const { auditWcaUsers, candidatesToCsv } = require('./wcaAnonymizationAudit');

const users = [
  {
    id: 1, wcaId: '2020PRES01', name: 'Present', username: 'present',
  },
  {
    id: 2, wcaId: '2020MISS01', name: 'Missing, User', username: '=formula',
  },
  {
    id: 3, wcaId: '2020RATE01', name: 'Rate Limited', username: 'rate',
  },
  {
    id: 4, wcaId: '2020ERRR01', name: 'Network Error', username: 'error',
  },
];

describe('WCA anonymization audit', () => {
  it('classifies only 404 responses as candidates', async () => {
    const fetchProfile = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockRejectedValueOnce(new Error('socket closed'));
    const wait = jest.fn().mockResolvedValue(undefined);

    const result = await auditWcaUsers({
      users,
      wcaSource: 'https://www.worldcubeassociation.org',
      fetchProfile,
      delayMs: 10,
      wait,
    });

    expect(result.present).toBe(1);
    expect(result.candidates).toEqual([
      expect.objectContaining({ internalId: 2, lookupStatus: 404 }),
    ]);
    expect(result.errors).toEqual([
      expect.objectContaining({ internalId: 3, status: 429 }),
      expect.objectContaining({ internalId: 4, reason: 'socket closed' }),
    ]);
    expect(fetchProfile).toHaveBeenNthCalledWith(
      1,
      'https://www.worldcubeassociation.org/persons/2020PRES01',
      { method: 'HEAD', headers: { Accept: 'text/html' } },
    );
    expect(wait).toHaveBeenCalledTimes(3);
  });

  it('writes a safe candidate-only CSV', () => {
    const csv = candidatesToCsv([{
      internalId: 2,
      wcaId: '2020MISS01',
      name: 'Missing, "User"',
      username: '=formula',
      lookupStatus: 404,
      reason: 'WCA profile not found',
    }]);

    expect(csv).toContain('"Missing, ""User"""');
    expect(csv).toContain('"\'=formula"');
    expect(csv).not.toContain('email');
  });
});
