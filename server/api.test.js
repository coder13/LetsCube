/** @jest-environment node */
/* eslint-env jest */

const http = require('http');
const express = require('express');

jest.mock('./social/relationshipService', () => ({
  list: jest.fn().mockResolvedValue({ friends: [], reconciledAt: new Date() }),
}));

const relationshipService = require('./social/relationshipService');
const createApi = require('./api');

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

    const response = await get(server, '/api/friends');

    expect(response.statusCode).toBe(200);
    expect(relationshipService.list).toHaveBeenCalledWith({ id: 1 });
  });
});
