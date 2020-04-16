module.exports = (req, res, next) => {
  if (!req.isAuthenticated()) {
    res.status(403);
    res.send(JSON.stringify({
      code: 403,
      message: 'Unauthorized',
    }));
    res.end();
  } else {
    return next();
  }
};
