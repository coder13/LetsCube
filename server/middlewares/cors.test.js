/** @jest-environment node */
/* eslint-env jest */

const http = require('http');
const cors = require('cors');
const express = require('express');
const { createCorsOptions } = require('./cors');

const request = (server, origin) => new Promise((resolve, reject) => {
  const req = http.request({
    headers: origin ? { origin } : {},
    host: '127.0.0.1',
    method: 'GET',
    path: '/',
    port: server.address().port,
  }, (res) => {
    res.resume();
    res.on('end', () => resolve({ headers: res.headers, status: res.statusCode }));
  });
  req.on('error', reject);
  req.end();
});

describe('CORS origin allowlist', () => {
  let server;

  beforeEach((done) => {
    const app = express();
    app.use(cors(createCorsOptions(['https://letscube.net', 'http://localhost:3000'])));
    app.get('/', (req, res) => res.json({ ok: true }));
    server = app.listen(0, '127.0.0.1', () => done());
  });

  afterEach((done) => {
    server.close(() => done());
  });

  it('permits configured credentialed browser origins', async () => {
    const response = await request(server, 'https://letscube.net');

    expect(response).toEqual(expect.objectContaining({ status: 200 }));
    expect(response.headers).toEqual(expect.objectContaining({
      'access-control-allow-credentials': 'true',
      'access-control-allow-origin': 'https://letscube.net',
    }));
  });

  it('does not grant CORS permission to an unconfigured origin', async () => {
    const response = await request(server, 'https://untrusted.example');

    expect(response).toEqual(expect.objectContaining({ status: 200 }));
    expect(response.headers).not.toHaveProperty('access-control-allow-credentials');
    expect(response.headers).not.toHaveProperty('access-control-allow-origin');
  });

  it('leaves same-origin and non-browser requests working', async () => {
    const response = await request(server);

    expect(response).toEqual(expect.objectContaining({ status: 200 }));
    expect(response.headers).not.toHaveProperty('access-control-allow-origin');
  });
});
