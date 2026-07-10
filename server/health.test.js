/* eslint-env jest */

const { createHealthHandler, createHealthReporter } = require('./health');

describe('health reporting', () => {
  const fixedTime = new Date('2026-07-10T12:00:00.000Z');

  it('reports healthy dependencies', async () => {
    const reportHealth = createHealthReporter({
      service: 'api',
      checks: {
        mongodb: () => true,
        postgres: async () => true,
      },
      now: () => fixedTime,
      uptime: () => 12.9,
    });

    await expect(reportHealth()).resolves.toEqual({
      status: 'ok',
      service: 'api',
      timestamp: fixedTime.toISOString(),
      uptimeSeconds: 12,
      checks: {
        mongodb: 'ok',
        postgres: 'ok',
      },
    });
  });

  it('reports failed and timed-out dependencies without exposing errors', async () => {
    const reportHealth = createHealthReporter({
      service: 'socket',
      checks: {
        mongodb: () => {
          throw new Error('connection details');
        },
        redis: () => new Promise(() => {}),
      },
      checkTimeoutMs: 1,
      now: () => fixedTime,
      uptime: () => 3,
    });

    await expect(reportHealth()).resolves.toEqual({
      status: 'error',
      service: 'socket',
      timestamp: fixedTime.toISOString(),
      uptimeSeconds: 3,
      checks: {
        mongodb: 'error',
        redis: 'error',
      },
    });
  });

  it('returns 503 and disables caching when a health check fails', async () => {
    const report = {
      status: 'error',
      service: 'api',
      checks: { mongodb: 'error' },
    };
    const response = {
      setHeader: jest.fn(),
      end: jest.fn(),
    };
    const handler = createHealthHandler(jest.fn().mockResolvedValue(report));

    await handler({}, response);

    expect(response.statusCode).toBe(503);
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/json; charset=utf-8',
    );
    expect(response.end).toHaveBeenCalledWith(JSON.stringify(report));
  });
});
