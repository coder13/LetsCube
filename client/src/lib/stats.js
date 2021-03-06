const sum = (a, b) => a + b;
const average = (a) => (a.length ? a.reduce(sum) / a.length : undefined);
const getTimeOrDNF = (a) => (a && !(a.penalties && a.penalties.DNF) ? a.time : -1);
const sort = (a, b) => {
  if (a > 0 && b > 0) {
    return a - b;
  }

  if (a < 0) {
    return 1;
  }

  if (b < 0) {
    return -1;
  }

  return 0;
};

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
  if (lastN[lastN.length - 2] < 0) {
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

  return averages.filter((i) => i > 0).sort(sort)[0] || undefined;
};

export const bestSingle = (attempts) => attempts.filter((i) => i > 0).sort(sort)[0];

export const mean = (attempts) => average(attempts.filter((t) => t > 0));

// Inputs attempts array and returns stats for every user.
export default function (_attempts, users) {
  const attempts = _attempts.map((i) => i.results);

  const stats = {};
  const bests = attempts.map((attempt) => Math.min(...Object.keys(attempt)
    .map((userId) => (attempt[userId].penalties && attempt[userId].penalties.DNF
      ? -1 : attempt[userId].time)).filter((time) => time > 0)));

  users.forEach((user) => {
    let userAttempts = attempts.map((attempt) => attempt[user.id]);

    if (!userAttempts || userAttempts.length === 0) {
      return;
    }

    const latestAttempt = userAttempts[userAttempts.length - 1];

    // remove last attempt if it doesn't exist
    userAttempts = latestAttempt ? userAttempts : userAttempts.slice(0, -1);

    userAttempts = userAttempts.map(getTimeOrDNF);

    let wins = 0;
    for (let i = 0; i < attempts.length; i += 1) {
      if (attempts[i][user.id] && !attempts[i][user.id].penalties?.DNF
          && Math.round(attempts[i][user.id].time) === Math.round(bests[i])) {
        wins += 1;
      }
    }

    // bests.map((time, index) => attempts[index][user.id]
    //  attempts[index][user.id].time).reduce((a, b) => a + b)

    stats[user.id] = {
      wins,
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

  stats.bests = bests;
  return stats;
}

// 8 place spread 10/8/6/5/4/3/2/1

const calculateGrandPrixRules = (result, place) => {
  switch (place) {
    case 0: return 10;
    case 1: return 8;
    case 2: return 6;
    case 3: return 5;
    case 4: return 4;
    case 5: return 3;
    case 6: return 2;
    case 7: return 1;
    default: return 0;
  }
};

export const calculatePointsForAttempt = (type, results) => {
  const sortedResults = Object.keys(results)
    .map((key) => ({
      id: key,
      time: getTimeOrDNF(results[key]),
    }))
    .filter((result) => result.time > 0)
    .sort((a, b) => sort(a.time, b.time))
    .map((result, index) => ({
      id: result.id,
      time: result.time,
      points: calculateGrandPrixRules(result, index),
    }));

  const points = {};

  sortedResults.forEach((result) => {
    points[result.id] = result.points;
  });

  return points;
};

export const calculatePointsForAllAttempts = (allPoints) => {
  const points = {};

  allPoints.forEach((attempt) => {
    // if (!attempt) {
    //   console.error('attempt.points doesn\'t exist', attempt);
    //   return;
    // }

    Object.keys(attempt).forEach((key) => {
      const result = attempt[key];
      if (points[key]) {
        points[key] += result;
      } else {
        points[key] = result;
      }
    });
  });

  return points;
};
