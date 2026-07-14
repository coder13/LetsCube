const pad = (n) => (n < 10 ? '0' : '') + n;
const fixed = (n, d) => Number(n).toFixed(d === undefined ? 2 : d);

export const formatRawTime = (time) => {
  if (time === undefined || time === null || time < 0) {
    return '0.00';
  }

  let s = time / 1000;

  const hours = Math.floor(s / 3600);
  s %= 3600;
  const minutes = Math.floor(s / 60);
  const seconds = fixed(s % 60, s > 600 ? 0 : 2);

  return `${hours ? `${hours}:` : ''}${minutes ? `${hours ? pad(minutes) : minutes}:` : ''}${minutes ? pad(seconds) : seconds}`;
};

/*
  time: number in terms of milliseconds
  Options:
    - milli:      number of decimals,
*/
export const formatTime = (time, options) => {
  const _options = { ...options };
  const { inspection, AUF, DNF } = _options;

  if (time === undefined || time === null || time < 0) {
    return 'DNF';
  }

  const formattedTime = formatRawTime(time);
  const formattedTimeWithPenalties = `${inspection ? '+' : ''}${formattedTime}${AUF ? '+' : ''}`;
  return DNF ? `DNF(${formattedTimeWithPenalties})` : formattedTimeWithPenalties;
};

export const parseNumericalTime = (time) => {
  const seconds = time % 10000;
  const minutes = ((time - seconds) / 10000) % 100;
  const hours = Math.floor((time - seconds) / 10000 / 100);
  return (seconds + minutes * 6000 + hours * 360000) * 10;
};

// Returns undefined for invalid input
export const parseTime = (inputTime) => {
  if (!inputTime) {
    return undefined;
  }

  const match = inputTime.match(/^(?:(\d*):)??(?:(\d*):)?(\d+)?(?:[.,](\d*))?$/);

  if (!match) {
    return undefined;
  }

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  const decimalStr = match[4] || '';
  const decimal = parseInt(decimalStr || '0', 10);
  const denominator = 10 ** (decimalStr.length - 2);
  const centiSeconds = !decimal ? 0 : Math.round(decimal / denominator);

  if (!match[1] && !match[2] && !match[4]) {
    return parseNumericalTime(seconds);
  }

  return (((((hours * 3600) + minutes * 60) + seconds) * 100) + centiSeconds) * 10;
};

// Better refresh and cross compatability.
const requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame
  || window.mozRequestAnimationFrame || window.oRequestAnimationFrame
  || window.msRequestAnimationFrame
  || ((fn) => window.setTimeout(fn, 1000 / 60));

const cancelAnimationFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame
  || window.mozCancelRequestAnimationFrame
  || window.oCancelRequestAnimationFrame
  || window.msCancelRequestAnimationFrame || window.clearTimeout;

export const setInterval = (fn) => {
  // Have to use an object here to store a reference
  // to the requestAnimationFrame ID.
  const handle = {};

  const interval = () => {
    fn.call();
    handle.value = requestAnimationFrame(interval);
  };

  handle.value = requestAnimationFrame(interval);
  return handle;
};

export const clearInterval = (interval) => {
  if (interval) {
    cancelAnimationFrame(interval.value);
  }
};

export const now = () => (window.performance && window.performance.now
  ? window.performance.now.bind(window.performance)
  : Date.now)();

const uuidByteToHex = Array.from(
  { length: 256 },
  (_, index) => (index + 0x100).toString(16).slice(1),
);

export const uuid = () => {
  const crypto = window.crypto || window.msCrypto;

  if (crypto && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;


    return [
      uuidByteToHex[bytes[0]],
      uuidByteToHex[bytes[1]],
      uuidByteToHex[bytes[2]],
      uuidByteToHex[bytes[3]],
      '-',
      uuidByteToHex[bytes[4]],
      uuidByteToHex[bytes[5]],
      '-',
      uuidByteToHex[bytes[6]],
      uuidByteToHex[bytes[7]],
      '-',
      uuidByteToHex[bytes[8]],
      uuidByteToHex[bytes[9]],
      '-',
      uuidByteToHex[bytes[10]],
      uuidByteToHex[bytes[11]],
      uuidByteToHex[bytes[12]],
      uuidByteToHex[bytes[13]],
      uuidByteToHex[bytes[14]],
      uuidByteToHex[bytes[15]],
    ].join('');
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : ((random % 4) + 8);
    return value.toString(16);
  });
};
