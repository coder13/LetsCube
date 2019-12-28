module.exports = (req, res, next) => {
  if (!req.isAuthenticated()) {
    res.status(403);
    res.render({
      code: 403,
      message: 'Unauthorized'
    })
  }

  return next();
};