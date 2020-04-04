const pad = (n) => (n < 10 ? '0' : '') + n;
const fixed = (n,d) => Number(n).toFixed(d === undefined ? 2 : d);

/*
  time: number in terms of milliseconds
  Options:
    - milli:      number of decimals,
    - inspecting: boolean
*/
export const formatTime = (time, options) => {
  if (time === undefined || time === null || time < 0) {
    return 'DNF';
  }

  let s = time / 1000;
  let hours = Math.floor(s / 3600);
  s %= 3600;
  let minutes = Math.floor(s / 60);
  let seconds = fixed(s % 60, (minutes + hours * 60) > 10 ? 0 : 2);

  return `${hours ? hours + ':' : ''}${minutes ? (hours ? pad(minutes, '0') : minutes) + ':' : ''}${minutes ? pad(seconds, '0') : seconds}`;
};