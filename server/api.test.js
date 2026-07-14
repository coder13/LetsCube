/** @jest-environment node */
/* eslint-env jest */

jest.mock('./models', () => ({
  User: { findOne: jest.fn() },
}));
jest.mock('./middlewares/auth.js', () => (req, res, next) => next());

const { User } = require('./models');
const router = require('./api')();

const updateUsernameHandler = router.stack
  .find((layer) => layer.route && layer.route.path === '/updateUsername')
  .route.stack[1].handle;

const response = () => {
  const res = {
    json: jest.fn(),
    send: jest.fn(),
    status: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};

describe('username API responses', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns stable 400 details for invalid input', async () => {
    const req = {
      body: { username: 'name@example.com' },
      user: { id: 1, save: jest.fn() },
    };
    const res = response();

    await updateUsernameHandler(req, res);

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

    await updateUsernameHandler(req, res);

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

    await updateUsernameHandler({ body: {}, user: { id: 1 } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
      code: 'MISSING_USERNAME',
      status: 400,
    }));
  });
});
