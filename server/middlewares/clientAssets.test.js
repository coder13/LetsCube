/** @jest-environment node */
/* eslint-env jest */

const http = require('http');
const path = require('path');
const express = require('express');
const { createClientAssetsRouter } = require('./clientAssets');
const { apiRateLimitOptions } = require('./apiRateLimit');

const request = (server) => new Promise((resolve, reject) => {
  const req = http.request({
    host: '127.0.0.1',
    method: 'GET',
    path: '/missing-client-route',
    port: server.address().port,
  }, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => resolve({ body, status: res.statusCode }));
  });
  req.on('error', reject);
  req.end();
});

describe('client asset rate limiting', () => {
  let server;

  beforeEach((done) => {
    const app = express();
    app.use(createClientAssetsRouter(
      path.join(__dirname, '../../client'),
      apiRateLimitOptions({ limit: 1, windowMs: 60_000 }),
    ));
    server = app.listen(0, '127.0.0.1', () => done());
  });

  afterEach((done) => {
    server.close(() => done());
  });

  it('serves the client fallback', async () => {
    const response = await request(server);

    expect(response.status).toBe(200);
    expect(response.body).toContain('<html lang="en">');
    expect(await request(server)).toEqual({
      body: '{"code":"rate_limited","message":"Too many requests. Please try again later."}',
      status: 429,
    });
  });
});
