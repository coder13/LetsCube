import {
  aoN, bestAoN, mean, bestSingle,
} from './stats';

test('Calculates a basic ao5', () => {
  const times = [10, 20, 30, 40, 50];
  const ao5 = aoN(5)(times);
  expect(ao5).toBe(30);
});

test('Calculates ao5 with DNFs', () => {
  expect(aoN(5)([10, -1, 20, 30, 100])).toBe(50);
  expect(aoN(5)([10, -1, -1, 30, 100])).toBe(-1);
});

test('Handles not enough input', () => {
  expect(aoN(5)([10, 20, 30, 40])).toBe(30);
  expect(aoN(5)([10, 20, 30])).toBe(undefined);
});

test('Correctly calculates best ao5', () => {
  expect(bestAoN(5)([500, 30, 200, 50, 100, 10, 20, 300, 40])).toBe(160 / 3);
});

test('Calculates mean', () => {
  expect(mean([-1, 500, 30, 200, 50, 100, -1, 10, 20, 300, 40])).toBe(1250 / 9);
});

test('Calculates best single', () => {
  expect(bestSingle([500, 30, -1, 50, 100, 10, 20, 300, -1])).toBe(10);
});
