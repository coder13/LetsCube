/** @jest-environment node */
/* eslint-env jest */

const {
  PAIR_REQUEST_LIMIT,
  PAIR_REQUEST_WINDOW_SECONDS,
  USER_REQUEST_LIMIT,
  USER_REQUEST_WINDOW_SECONDS,
  createRequestRateLimiter,
} = require('./requestRateLimiter');

const createAtomicRedis = (getNow) => {
  const entries = new Map();
  const entryFor = (key) => {
    const entry = entries.get(key);
    if (entry && entry.expiresAt <= getNow().getTime()) {
      entries.delete(key);
      return undefined;
    }
    return entry;
  };
  const ttl = (key) => {
    const entry = entryFor(key);
    return entry ? Math.max(1, Math.ceil((entry.expiresAt - getNow().getTime()) / 1000)) : -2;
  };
  const evalScript = jest.fn(async (
    script,
    keyCount,
    userKey,
    pairKey,
    userLimit,
    pairLimit,
    userWindowSeconds,
    pairWindowSeconds,
  ) => {
    expect(keyCount).toBe(2);
    expect(script).toContain("redis.call('INCR', KEYS[1])");
    const userCount = (entryFor(userKey) || { count: 0 }).count;
    const pairCount = (entryFor(pairKey) || { count: 0 }).count;
    if (userCount >= Number(userLimit)) {
      return [0, 'user', ttl(userKey)];
    }
    if (pairCount >= Number(pairLimit)) {
      return [0, 'pair', ttl(pairKey)];
    }
    entries.set(userKey, {
      count: userCount + 1,
      expiresAt: getNow().getTime() + (Number(userWindowSeconds) * 1000),
    });
    entries.set(pairKey, {
      count: pairCount + 1,
      expiresAt: getNow().getTime() + (Number(pairWindowSeconds) * 1000),
    });
    return [1, '', 0];
  });
  return { entries, eval: evalScript };
};

describe('request creation rate limiter', () => {
  it('atomically enforces the user window across concurrent pairs', async () => {
    const now = new Date('2026-07-12T12:00:00.000Z');
    const redis = createAtomicRedis(() => now);
    const limiter = createRequestRateLimiter({ client: redis });

    const results = await Promise.allSettled(Array.from(
      { length: USER_REQUEST_LIMIT + 1 },
      (_, index) => limiter.consume({ actorId: 1, pairKey: `1:${1000 + index}` }),
    ));

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(USER_REQUEST_LIMIT);
    expect(results.filter(({ status }) => status === 'rejected')).toEqual([
      expect.objectContaining({
        reason: expect.objectContaining({
          code: 'request_rate_limited',
          retryAfterSeconds: USER_REQUEST_WINDOW_SECONDS,
          statusCode: 429,
        }),
      }),
    ]);
    expect(redis.eval).toHaveBeenCalledTimes(USER_REQUEST_LIMIT + 1);
  });

  it('expires the pair window without any cleanup job', async () => {
    let now = new Date('2026-07-12T12:00:00.000Z');
    const redis = createAtomicRedis(() => now);
    const limiter = createRequestRateLimiter({ client: redis });

    await Promise.all(Array.from(
      { length: PAIR_REQUEST_LIMIT },
      () => limiter.consume({ actorId: 1, pairKey: '1:2' }),
    ));
    await expect(limiter.consume({ actorId: 1, pairKey: '1:2' })).rejects.toMatchObject({
      code: 'request_rate_limited',
      retryAfterSeconds: PAIR_REQUEST_WINDOW_SECONDS,
    });

    now = new Date(now.getTime() + (PAIR_REQUEST_WINDOW_SECONDS * 1000));
    await expect(limiter.consume({ actorId: 1, pairKey: '1:2' })).resolves.toBeUndefined();
  });

  it('fails closed and logs when Redis cannot execute the atomic operation', async () => {
    const error = new Error('Redis unavailable');
    const redis = { eval: jest.fn().mockRejectedValue(error) };
    const rateLimitLogger = { error: jest.fn() };
    const limiter = createRequestRateLimiter({ client: redis, rateLimitLogger });

    await expect(limiter.consume({ actorId: 1, pairKey: '1:2' })).rejects.toMatchObject({
      code: 'request_rate_limit_unavailable',
      statusCode: 503,
    });
    expect(rateLimitLogger.error).toHaveBeenCalledWith(error);
  });
});
