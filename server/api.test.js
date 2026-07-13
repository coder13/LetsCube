/** @jest-environment node */
/* eslint-env jest */

const http = require('http');
const express = require('express');

jest.mock('./models', () => ({
  User: { findOne: jest.fn() },
}));
jest.mock('./middlewares/auth.js', () => (req, res, next) => next());
jest.mock('./social/relationshipService', () => ({
  list: jest.fn().mockResolvedValue({ friends: [], reconciledAt: new Date() }),
}));

const { User } = require('./models');
const relationshipService = require('./social/relationshipService');
const createApi = require('./api');

const response = () => {
  const res = {
    json: jest.fn(),
    send: jest.fn(),
    status: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};

const updateUsernameHandler = () => createApi({
  get: () => ({ socialFeatures: { enabled: false } }),
}).stack.find((layer) => layer.route && layer.route.path === '/updateUsername')
  .route.stack[1].handle;

describe('username API responses', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns stable 400 details for invalid input', async () => {
    const req = {
      body: { username: 'name@example.com' },
      user: { id: 1, save: jest.fn() },
    };
    const res = response();

    await updateUsernameHandler()(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
      code: 'INVALID_USERNAME',
      status: 400,
    }));
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it('returns stable 409 details for a case-insensitive conflict', async () => {
    User.findOne.mockResolvedValue({ id: 2 });
    const req = {
      body: { username: 'CUBER' },
      user: { id: 1, save: jest.fn() },
    };
    const res = response();

    await updateUsernameHandler()(req, res);

    expect(User.findOne).toHaveBeenCalledWith({ usernameNormalized: 'cuber' });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
      code: 'USERNAME_TAKEN',
      status: 409,
    }));
    expect(req.user.save).not.toHaveBeenCalled();
  });

  it('returns stable 400 details when username is omitted', async () => {
    const res = response();

    await updateUsernameHandler()({ body: {}, user: { id: 1 } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
      code: 'MISSING_USERNAME',
      status: 400,
    }));
  });
});

const get = (server, path) => new Promise((resolve, reject) => {
  const req = http.get({
    headers: { authorization: 'test-session' },
    host: '127.0.0.1',
    path,
    port: server.address().port,
  }, (res) => {
    let body = '';
    res.on('data', (chunk) => {
      body += chunk;
    });
    res.on('end', () => resolve({ body: JSON.parse(body), statusCode: res.statusCode }));
  });
  req.on('error', reject);
});

const startServer = (socialFeaturesEnabled) => {
  const app = express();
  app.set('config', { socialFeatures: { enabled: socialFeaturesEnabled } });
  app.use((req, res, next) => {
    req.isAuthenticated = () => req.headers.authorization === 'test-session';
    req.user = { id: 1 };
    next();
  });
  app.use('/api', createApi(app));
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
};

describe('social feature route gate', () => {
  let server;

  afterEach((done) => {
    relationshipService.list.mockClear();
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  it('returns a disabled response by default without running social handlers', async () => {
    server = await startServer(false);

    await expect(get(server, '/api/friends')).resolves.toEqual({
      body: {
        code: 'feature_disabled',
        message: 'This feature is not available',
      },
      statusCode: 404,
    });
    expect(relationshipService.list).not.toHaveBeenCalled();
  });

  it('mounts authenticated social routes when explicitly enabled', async () => {
    server = await startServer(true);

    const result = await get(server, '/api/friends');

    expect(result.statusCode).toBe(200);
    expect(relationshipService.list).toHaveBeenCalledWith({ id: 1 });
  });
});
