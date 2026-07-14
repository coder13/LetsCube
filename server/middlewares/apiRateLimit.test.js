/** @jest-environment node */
/* eslint-env jest */

const http = require('http');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { apiRateLimitOptions } = require('./apiRateLimit');

const request = (server) => new Promise((resolve, reject) => {
  const req = http.request({
    host: '127.0.0.1',
    method: 'GET',
    path: '/',
    port: server.address().port,
  }, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => resolve({ body: JSON.parse(body), status: res.statusCode }));
  });
  req.on('error', reject);
  req.end();
});

describe('API rate limiter', () => {
  let server;

  beforeEach((done) => {
    const app = express();
    app.use(rateLimit(apiRateLimitOptions({ limit: 1, windowMs: 60_000 })));
    app.get('/', (req, res) => res.json({ ok: true }));
    server = app.listen(0, '127.0.0.1', () => done());
  });

  afterEach((done) => { server.close(done); });

  it('rejects requests beyond the configured IP window', async () => {
    expect(await request(server)).toEqual({ body: { ok: true }, status: 200 });
    expect(await request(server)).toEqual({
      body: {
        code: 'rate_limited',
        message: 'Too many requests. Please try again later.',
      },
      status: 429,
    });
  });
});
