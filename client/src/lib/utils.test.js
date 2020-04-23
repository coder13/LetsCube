import { formatTime } from './utils';

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
