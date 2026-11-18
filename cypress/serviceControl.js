const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const services = {
  api: {
    entry: 'server/index.js',
    healthUrl: 'http://127.0.0.1:8080/health/api',
    log: 'server.log',
    pidFile: '.tmp/ci-api.pid',
  },
  socket: {
    entry: 'server/socket/index.js',
    healthUrl: 'http://127.0.0.1:9000/health/socket',
    log: 'socket.log',
    pidFile: '.tmp/ci-socket.pid',
  },
};

const wait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

const isRunning = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') return false;
    throw error;
  }
};

const waitForStop = async (pid) => {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (!isRunning(pid)) return;
    await wait(100);
  }
  throw new Error(`Process ${pid} did not stop gracefully.`);
};

const waitForHealth = async (url) => {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      // The service can refuse connections while it starts.
    }
    await wait(100);
  }
  throw new Error(`Service did not become healthy at ${url}.`);
};

const restartService = async (name) => {
  const service = services[name];
  if (!service) throw new Error(`Unknown service: ${name}`);

  const pidPath = path.join(root, service.pidFile);
  const previousPid = Number(fs.readFileSync(pidPath, 'utf8').trim());
  if (!Number.isInteger(previousPid) || previousPid <= 1) {
    throw new Error(`Invalid PID in ${service.pidFile}.`);
  }
  if (isRunning(previousPid)) {
    process.kill(previousPid, 'SIGTERM');
    await waitForStop(previousPid);
  }

  const logFd = fs.openSync(path.join(root, service.log), 'a');
  const child = spawn(process.execPath, [service.entry], {
    cwd: root,
    env: process.env,
    stdio: ['ignore', logFd, logFd],
  });
  fs.closeSync(logFd);
  child.unref();
  fs.writeFileSync(pidPath, `${child.pid}\n`);

  await waitForHealth(service.healthUrl);
  return null;
};

module.exports = { restartService };
