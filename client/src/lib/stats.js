const sum = (a, b) => a + b;
const average = (a) => (a.length ? a.reduce(sum) / a.length : undefined);
const getTimeOrDNF = (a) => (a && !(a.penalties && a.penalties.DNF) ? a.time : -1);

export const aoN = (n) => (attempts) => {
  const lastN = attempts.slice(-n);

  if (lastN.length < (n - 1)) {
    return undefined;
  }

  lastN.sort((a, b) => a - b);

  // if we have 2 DNFs / invalid attempts
  if (lastN[1] < 0) {
    return -1;
  }

  return lastN.slice(1, n - 1).reduce(sum) / (n - 2);
};

export const mean = (attempts) => average(attempts.filter((t) => t > 0));

// Inputs attempts array and returns stats for every user.
export default function (_attempts, users) {
  const attempts = _attempts.map((i) => i.results);

  const stats = {};
  users.forEach((user) => {
    let userAttempts = attempts.map((attempt) => attempt[user.id]);

    if (!userAttempts || userAttempts.length === 0) {
      return;
    }

    const latestAttempt = userAttempts[userAttempts.length - 1];

    // remove last attempt if it doesn't exist
    userAttempts = latestAttempt ? userAttempts : userAttempts.slice(0, -1);

    userAttempts = userAttempts.map(getTimeOrDNF);

    stats[user.id] = {
      mean: mean(userAttempts),
      ao5: aoN(5)(userAttempts),
      ao12: aoN(12)(userAttempts),
    };
  });

  return stats;
}
