/** @jest-environment node */
/* eslint-env jest */

const { deserializeUser } = require('./index');
const http = require('http');
const express = require('express');
const createAuthRouter = require('./index');
const { apiRateLimitOptions } = require('../middlewares/apiRateLimit');

const request = (server) => new Promise((resolve, reject) => {
  const req = http.request({
    host: '127.0.0.1',
    method: 'POST',
    path: '/auth/logout',
    port: server.address().port,
  }, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.resume();
    res.on('end', () => resolve({
      body: body ? JSON.parse(body) : null,
      status: res.statusCode,
    }));
  });
  req.on('error', reject);
  req.end();
});

describe('session user deserialization', () => {
  it('uses the Mongoose promise API and returns the loaded user', async () => {
    const user = { id: 990001 };
    const User = { findOne: jest.fn().mockResolvedValue(user) };
    const done = jest.fn();

    await deserializeUser(User, 990001, done);

    expect(User.findOne).toHaveBeenCalledWith({ id: 990001 });
    expect(done).toHaveBeenCalledWith(null, user);
  });

  it('passes persistence errors to Passport', async () => {
    const error = new Error('database unavailable');
    const User = { findOne: jest.fn().mockRejectedValue(error) };
    const done = jest.fn();

    await deserializeUser(User, 990001, done);

    expect(done).toHaveBeenCalledWith(error);
  });
});

describe('authentication rate limiting', () => {
  let server;

  beforeEach((done) => {
    const app = express();
    const passport = {
      deserializeUser: jest.fn(),
      serializeUser: jest.fn(),
      use: jest.fn(),
    };
    app.set('config', {
      auth: {},
      wcaSource: 'https://wca.example',
    });
    app.use((req, res, next) => {
      req.logout = (callback) => callback();
      next();
    });
    app.use('/auth', createAuthRouter(
      app,
      passport,
      apiRateLimitOptions({ limit: 1, windowMs: 60_000 }),
    ));
    server = app.listen(0, '127.0.0.1', () => done());
  });

  afterEach((done) => {
    server.close(() => done());
  });

  it('rejects requests beyond the configured IP window', async () => {
    expect(await request(server)).toEqual({ body: null, status: 204 });
    expect(await request(server)).toEqual({
      body: {
        code: 'rate_limited',
        message: 'Too many requests. Please try again later.',
      },
      status: 429,
    });
  });
});
