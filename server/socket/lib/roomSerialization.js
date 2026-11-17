const mapToObject = (value) => {
  if (!(value instanceof Map)) {
    return value;
  }

  return Object.fromEntries([...value.entries()].map(([key, entry]) => [String(key), entry]));
};

const serializeAttempt = (attempt) => {
  if (!attempt) {
    return attempt;
  }

  const serialized = typeof attempt.toObject === 'function'
    ? attempt.toObject()
    : { ...attempt };
  serialized.results = mapToObject(serialized.results);
  return serialized;
};

const serializeRoomMask = (room, keys) => {
  const masked = Object.fromEntries(
    keys
      .filter((key) => room[key] !== undefined)
      .map((key) => [key, room[key]]),
  );

  ['competing', 'waitingFor', 'banned', 'inRoom', 'registered'].forEach((key) => {
    masked[key] = mapToObject(masked[key]);
  });

  if (Array.isArray(masked.attempts)) {
    masked.attempts = masked.attempts.map(serializeAttempt);
  }

  return masked;
};

module.exports = {
  mapToObject,
  serializeAttempt,
  serializeRoomMask,
};
