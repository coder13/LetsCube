const DEFAULT_DELAY_MS = 250;

const delay = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

const auditWcaUsers = async ({
  users,
  wcaSource,
  fetchProfile = fetch,
  delayMs = DEFAULT_DELAY_MS,
  wait = delay,
}) => {
  const candidates = [];
  const errors = [];
  let present = 0;

  for (let index = 0; index < users.length; index += 1) {
    const user = users[index];
    const url = `${wcaSource}/persons/${encodeURIComponent(user.wcaId)}`;

    try {
      // Only a definite not-found response is a candidate. Outages and rate
      // limits are inconclusive and must remain errors for manual follow-up.
      // eslint-disable-next-line no-await-in-loop
      const response = await fetchProfile(url, {
        method: 'HEAD',
        headers: { Accept: 'text/html' },
      });
      if (response && response.ok) {
        present += 1;
      } else if (response && response.status === 404) {
        candidates.push({
          internalId: user.id,
          wcaId: user.wcaId,
          name: user.name,
          username: user.username,
          lookupStatus: 404,
          reason: 'WCA profile not found',
        });
      } else {
        errors.push({
          internalId: user.id,
          wcaId: user.wcaId,
          status: response && response.status,
          reason: response ? `Unexpected HTTP ${response.status}` : 'No response',
        });
      }
    } catch (error) {
      errors.push({
        internalId: user.id,
        wcaId: user.wcaId,
        reason: error.message || 'Network error',
      });
    }

    if (delayMs > 0 && index < users.length - 1) {
      // eslint-disable-next-line no-await-in-loop
      await wait(delayMs);
    }
  }

  return {
    checked: users.length,
    present,
    candidates,
    errors,
  };
};

const csvValue = (value) => {
  if (value === undefined || value === null) {
    return '';
  }
  let stringValue = String(value);
  if (/^[=+\-@]/.test(stringValue)) {
    stringValue = `'${stringValue}`;
  }
  return `"${stringValue.replace(/"/g, '""')}"`;
};

const candidatesToCsv = (candidates) => {
  const columns = ['internalId', 'wcaId', 'name', 'username', 'lookupStatus', 'reason'];
  const rows = candidates.map((candidate) => (
    columns.map((column) => csvValue(candidate[column])).join(',')
  ));
  return `${columns.join(',')}\n${rows.length ? `${rows.join('\n')}\n` : ''}`;
};

module.exports = {
  DEFAULT_DELAY_MS,
  auditWcaUsers,
  candidatesToCsv,
};
