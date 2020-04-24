import { formatTime, parseTime } from './utils';

test('Handles DNF input', () => {
  expect(formatTime(undefined)).toBe('DNF');
  expect(formatTime(null)).toBe('DNF');
  expect(formatTime(-1)).toBe('DNF');
});

test('Handles time conversions', () => {
  expect(formatTime(20)).toBe('0.02');
  expect(formatTime(200)).toBe('0.20');
  expect(formatTime(2220)).toBe('2.22');
  expect(formatTime(62220)).toBe('1:02.22');
  expect(formatTime(122220)).toBe('2:02.22');
});

test('Handles penalties', () => {
  expect(formatTime(20, { DNF: true })).toBe('DNF(0.02)');
  expect(formatTime(20, { AUF: true })).toBe('2.02+');
  expect(formatTime(20, { DNF: true, AUF: true })).toBe('DNF(2.02+)');
  expect(formatTime(20, { inspection: true, DNF: true, AUF: true })).toBe('DNF(+4.02+)');
});

test('Parses numerical time', () => {
  expect(parseTime('1')).toBe(10);
  expect(parseTime('11')).toBe(110);
  expect(parseTime('111')).toBe(1110);
  expect(parseTime('1111')).toBe(11110);
  expect(parseTime('11111')).toBe(71110);
  expect(parseTime('111111')).toBe(671110);
});

test('Parses stopwatch time', () => {
  expect(parseTime('5.00')).toBe(5000);
  expect(parseTime('50.45')).toBe(50450);
  expect(parseTime('2:50.23')).toBe(170230);
  expect(parseTime('2:50')).toBe(170000);
  expect(parseTime('21:50')).toBe(1310000);
  expect(parseTime('1:21:50')).toBe(4910000);
  expect(parseTime('1:21:')).toBe(4860000);
  expect(parseTime('1:21:05')).toBe(4865000);
  expect(parseTime('1:21:5')).toBe(4865000);
});

test('Parser handles wrong input', () => {
  expect(parseTime()).toBe(undefined);
  expect(parseTime('a')).toBe(undefined);
});
