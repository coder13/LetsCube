const isUserApiRequest = (req) => /^\/api\/users(?:\/|$)/.test(req.path);

module.exports = { isUserApiRequest };
