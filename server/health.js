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
  const checkResults = await Promise.all(Object.entries(checks).map(async ([name, value]) => {
    const descriptor = typeof value === 'function' ? { check: value } : value;
    const required = descriptor.required !== false;
    const status = await runCheck(descriptor.check, checkTimeoutMs) ? 'ok' : 'error';
    return { name, required, status };
  }));
  const normalizedChecks = Object.fromEntries(checkResults.map(({ name, status }) => (
    [name, status]
  )));
  const requiredCheckFailed = checkResults.some(({ required, status }) => (
    required && status === 'error'
  ));
  const optionalCheckFailed = checkResults.some(({ required, status }) => (
    !required && status === 'error'
  ));
  let status = 'ok';
  if (requiredCheckFailed) {
    status = 'error';
  } else if (optionalCheckFailed) {
    status = 'degraded';
  }

  return {
    status,
    service,
    timestamp: now().toISOString(),
    uptimeSeconds: Math.floor(uptime()),
    checks: normalizedChecks,
  };
};

const createHealthHandler = (reportHealth) => async (_req, res) => {
  const report = await reportHealth();

  res.statusCode = report.status === 'error' ? 503 : 200;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(report));
};

module.exports = {
  createHealthHandler,
  createHealthReporter,
};
