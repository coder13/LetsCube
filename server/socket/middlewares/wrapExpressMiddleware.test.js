const wrapExpressMiddleware = require('./wrapExpressMiddleware');

it('runs Express middleware against the Socket.IO request', () => {
  const request = {};
  const next = jest.fn();
  const middleware = jest.fn((req, res, done) => {
    req.session = { passport: { user: 8184 } };
    done();
  });

  wrapExpressMiddleware(middleware)({ request }, next);

  expect(middleware).toHaveBeenCalledWith(request, {}, next);
  expect(request.session.passport.user).toBe(8184);
  expect(next).toHaveBeenCalledTimes(1);
});
