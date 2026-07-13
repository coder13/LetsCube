/** @jest-environment node */
/* eslint-env jest */

const http = require('http');
const express = require('express');

const createFriendsRouter = require('./friends');

const request = (server, {
  authenticated = true, body, method = 'GET', path = '/api/friends',
} = {}) => new Promise((resolve, reject) => {
  const serializedBody = body ? JSON.stringify(body) : null;
  const options = {
    headers: {
      ...(authenticated ? { authorization: 'test-session' } : {}),
      ...(serializedBody ? {
        'content-length': Buffer.byteLength(serializedBody),
        'content-type': 'application/json',
      } : {}),
    },
    host: '127.0.0.1',
    method,
    path,
    port: server.address().port,
  };
  const req = http.request(options, (res) => {
    let responseBody = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      responseBody += chunk;
    });
    res.on('end', () => resolve({
      body: responseBody ? JSON.parse(responseBody) : null,
      statusCode: res.statusCode,
    }));
  });
  req.on('error', reject);
  if (serializedBody) {
    req.write(serializedBody);
  }
  req.end();
});

describe('friend REST routes', () => {
  let server;
  let service;

  beforeEach((done) => {
    service = {
      acceptRequest: jest.fn().mockResolvedValue({ outcome: 'request_accepted' }),
      block: jest.fn().mockResolvedValue({ outcome: 'blocked' }),
      cancelRequest: jest.fn().mockResolvedValue({ outcome: 'request_canceled' }),
      declineRequest: jest.fn().mockResolvedValue({ outcome: 'request_declined' }),
      list: jest.fn().mockResolvedValue({ friends: [], reconciledAt: new Date() }),
      sendRequest: jest.fn().mockResolvedValue({ outcome: 'request_created' }),
      unblock: jest.fn().mockResolvedValue({ outcome: 'unblocked' }),
      unfriend: jest.fn().mockResolvedValue({ outcome: 'unfriended' }),
    };
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.isAuthenticated = () => req.headers.authorization === 'test-session';
      if (req.isAuthenticated()) {
        req.user = { id: 1, name: 'Test User' };
      }
      next();
    });
    app.use('/api/friends', createFriendsRouter(service));
    server = app.listen(0, '127.0.0.1', done);
  });

  afterEach((done) => server.close(done));

  it('requires an authenticated session', async () => {
    const response = await request(server, { authenticated: false });

    expect(response.statusCode).toBe(403);
    expect(service.list).not.toHaveBeenCalled();
  });

  it('exposes the authoritative reconciliation snapshot', async () => {
    const response = await request(server);

    expect(response.statusCode).toBe(200);
    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    expect(response.body).toEqual(expect.objectContaining({ friends: [] }));
  });

  it.each([
    ['POST', '/api/friends/requests', { userId: 2 }, 'sendRequest', 201],
    ['DELETE', '/api/friends/requests/2', null, 'cancelRequest', 204],
    ['POST', '/api/friends/requests/2/accept', null, 'acceptRequest', 200],
    ['POST', '/api/friends/requests/2/decline', null, 'declineRequest', 204],
    ['DELETE', '/api/friends/2', null, 'unfriend', 204],
    ['PUT', '/api/friends/blocks/2', null, 'block', 204],
    ['DELETE', '/api/friends/blocks/2', null, 'unblock', 204],
  ])('maps %s %s to %s', async (method, path, body, serviceMethod, statusCode) => {
    const response = await request(server, { body, method, path });

    expect(response.statusCode).toBe(statusCode);
    expect(service[serviceMethod]).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      serviceMethod === 'sendRequest' ? 2 : '2',
    );
    if (response.body) {
      expect(response.body).not.toHaveProperty('relationship');
    }
  });

  it('returns stable error codes without exposing internal errors', async () => {
    service.sendRequest.mockRejectedValue(Object.assign(new Error('Unavailable'), {
      code: 'relationship_unavailable',
      statusCode: 409,
    }));

    const response = await request(server, {
      body: { userId: 2 },
      method: 'POST',
      path: '/api/friends/requests',
    });

    expect(response).toEqual({
      body: {
        code: 'relationship_unavailable',
        message: 'Unavailable',
      },
      statusCode: 409,
    });
  });
});
