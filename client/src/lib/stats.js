const sum = (a, b) => a + b;

const average = (a) => a.reduce(sum) / a.length;

export const mean = (attempts) => average(attempts.filter((t) => t > 0));

const getTimeOrDNF = (a) => (a && !(a.penalties && a.penalties.DNF) ? a.time : -1);

// Inputs attempts array and returns stats for every user.
export default function (_attempts, users) {
  const attempts = _attempts.map((i) => i.results);

  const stats = {};
  users.forEach((user) => {
    let userAttempts = attempts.map((attempt) => attempt[user.id]);
    const latestAttempt = userAttempts[userAttempts.length - 1];

    // remove last attempt if it doesn't exist
    userAttempts = latestAttempt ? userAttempts : userAttempts.slice(0, -1);
    userAttempts = userAttempts.map(getTimeOrDNF);

    stats[user.id] = {
      mean: mean(userAttempts),
    };
  });

  return stats;
}
