const pad = (n) => (n < 10 ? '0' : '') + n;
const fixed = (n, d) => Number(n).toFixed(d === undefined ? 2 : d);

/*
  time: number in terms of milliseconds
  Options:
    - milli:      number of decimals,
    - inspecting: boolean
*/
export const formatTime = (time) => {
  if (time === undefined || time === null || time < 0) {
    return 'DNF';
  }

  let s = time / 1000;
  const hours = Math.floor(s / 3600);
  s %= 3600;
  const minutes = Math.floor(s / 60);
  const seconds = fixed(s % 60, (minutes + hours * 60) > 10 ? 0 : 2);

  return `${hours ? `${hours}:` : ''}${minutes ? `${hours ? pad(minutes, '0') : minutes}:` : ''}${minutes ? pad(seconds, '0') : seconds}`;
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
