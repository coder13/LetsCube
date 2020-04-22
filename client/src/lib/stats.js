const sum = (a, b) => a + b;
const average = (a) => (a.length ? a.reduce(sum) / a.length : undefined);
const getTimeOrDNF = (a) => (a && !(a.penalties && a.penalties.DNF) ? a.time : -1);
const sort = (a, b) => a - b;

export const aoN = (n) => (attempts) => {
  if (!n) {
    return undefined;
  }

  const lastN = attempts.slice(-n);

  const d = Math.ceil(lastN.length * 0.05);

  if (lastN.length < (n - d)) {
    return undefined;
  }

  lastN.sort(sort);

  // if we have 2 DNFs / invalid attempts
  if (lastN[1] < 0) {
    return -1;
  }

  return lastN.slice(d, n - d).reduce(sum) / (n - d * 2);
};

export const bestAoN = (n) => (attempts) => {
  if (!n) {
    return undefined;
  }

  const averages = [];
  for (let i = 0; i <= attempts.length - n; i += 1) { // 55 - 50 = 5
    averages.push(aoN(n)(attempts.slice(i, i + n)));
  }

  console.log(n, attempts.length - n);
  console.log(averages);

  return averages.filter((i) => i > 0).sort(sort)[0] || undefined;
};

export const bestSingle = (attempts) => attempts.filter((i) => i > 0).sort(sort)[0];

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
      current: {
        single: userAttempts[userAttempts.length - 1] || userAttempts[userAttempts.length - 2],
        ao5: aoN(5)(userAttempts),
        ao12: aoN(12)(userAttempts),
        ao50: aoN(50)(userAttempts),
        ao100: aoN(100)(userAttempts),
      },
      best: {
        ao5: bestAoN(5)(userAttempts),
        ao12: bestAoN(12)(userAttempts),
        ao50: bestAoN(50)(userAttempts),
        ao100: bestAoN(100)(userAttempts),
        single: bestSingle(userAttempts),
      },
    };
  });

  return stats;
}
