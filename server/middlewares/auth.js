const banned = [47162, 106505];

module.exports = (req, res, next) => {
  if (!req.isAuthenticated()) {
    res.status(403);
    res.send(
      JSON.stringify({
        code: 403,
        message: "Unauthorized",
      })
    );
    res.end();
  } else if (req && req.user && req.user.id && banned.includes(req.user.id)) {
    res.status(403);
    res.send(
      JSON.stringify({
        code: 403,
        message: "Unauthorized",
      })
    );
    res.end();
  } else {
    return next();
  }
};
