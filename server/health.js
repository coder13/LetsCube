const runCheck = async (check, timeoutMs) => {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
    if (timer.unref) {
      timer.unref();
    }
  });

  const result = await Promise.race([
    Promise.resolve()
      .then(check)
      .then((healthy) => healthy !== false)
      .catch(() => false),
    timeout,
  ]);

  clearTimeout(timer);
  return result;
};

const createHealthReporter = ({
  service,
  checks,
  checkTimeoutMs = 2000,
  now = () => new Date(),
  uptime = () => process.uptime(),
}) => async () => {
  const checkResults = await Promise.all(Object.entries(checks).map(async ([name, check]) => (
    [name, await runCheck(check, checkTimeoutMs) ? 'ok' : 'error']
  )));
  const normalizedChecks = Object.fromEntries(checkResults);
  const healthy = Object.values(normalizedChecks).every((status) => status === 'ok');

  return {
    status: healthy ? 'ok' : 'error',
    service,
    timestamp: now().toISOString(),
    uptimeSeconds: Math.floor(uptime()),
    checks: normalizedChecks,
  };
};

const createHealthHandler = (reportHealth) => async (_req, res) => {
  const report = await reportHealth();

  res.statusCode = report.status === 'ok' ? 200 : 503;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(report));
};

module.exports = {
  createHealthHandler,
  createHealthReporter,
};
