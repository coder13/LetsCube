/** @jest-environment node */
/* eslint-env jest */

const http = require('http');
const express = require('express');
const session = require('express-session');
const lusca = require('lusca');

const request = (server, { cookie, headers, method = 'GET', path = '/' } = {}) => new Promise((resolve, reject) => {
  const req = http.request({
    headers: { 'x-forwarded-proto': 'https', ...(cookie ? { cookie } : {}), ...headers },
    host: '127.0.0.1',
    method,
    path,
    port: server.address().port,
  }, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => resolve({
      body: body ? JSON.parse(body) : null,
      cookie: res.headers['set-cookie'] && res.headers['set-cookie'][0].split(';')[0],
      setCookie: res.headers['set-cookie'] && res.headers['set-cookie'][0],
      status: res.statusCode,
    }));
  });
  req.on('error', reject);
  req.end();
});

describe('CSRF protection', () => {
  let server;

  beforeEach((done) => {
    const app = express();
    app.set('trust proxy', 1);
    app.use(session({
      cookie: {
        httpOnly: true,
        sameSite: 'strict',
        secure: true,
      },
      resave: false,
      saveUninitialized: false,
      secret: 'test-secret',
    }));
    app.use(lusca.csrf());
    app.get('/csrf-token', (req, res) => res.json({ csrfToken: req.csrfToken() }));
    app.post('/change', (req, res) => res.json({ changed: true }));
    app.use((err, req, res, next) => {
      if (err.message.startsWith('CSRF token')) {
        return res.status(403).json({ code: 'csrf_invalid' });
      }
      return next(err);
    });
    server = app.listen(0, '127.0.0.1', () => done());
  });

  afterEach((done) => { server.close(done); });

  it('requires a session token for state-changing requests', async () => {
    const tokenResponse = await request(server, { path: '/csrf-token' });
    expect(tokenResponse.status).toBe(200);
    expect(tokenResponse.body.csrfToken).toEqual(expect.any(String));
    expect(tokenResponse.cookie).toEqual(expect.stringContaining('connect.sid='));
    expect(tokenResponse.setCookie).toEqual(expect.stringContaining('Secure'));

    expect(await request(server, {
      cookie: tokenResponse.cookie,
      method: 'POST',
      path: '/change',
    })).toEqual(expect.objectContaining({
      body: { code: 'csrf_invalid' },
      status: 403,
    }));

    expect(await request(server, {
      cookie: tokenResponse.cookie,
      headers: { 'x-csrf-token': tokenResponse.body.csrfToken },
      method: 'POST',
      path: '/change',
    })).toEqual(expect.objectContaining({
      body: { changed: true },
      status: 200,
    }));
  });
});
