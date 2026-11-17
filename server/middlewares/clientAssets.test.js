/** @jest-environment node */
/* eslint-env jest */

const http = require('http');
const path = require('path');
const express = require('express');
const { createClientAssetsRouter } = require('./clientAssets');

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

describe('client assets', () => {
  let server;

  beforeEach((done) => {
    const app = express();
    app.use(createClientAssetsRouter(path.join(__dirname, '../../client')));
    server = app.listen(0, '127.0.0.1', () => done());
  });

  afterEach((done) => {
    server.close(() => done());
  });

  it('serves repeated client fallback requests without API rate limiting', async () => {
    const response = await request(server);

    expect(response.status).toBe(200);
    expect(response.body).toContain('<html lang="en">');
    expect((await request(server)).status).toBe(200);
  });
});
