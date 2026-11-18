import { promptForAppUpdate, UPDATE_MESSAGE } from './appUpdate';

it('applies a waiting update after user approval', () => {
  const applyUpdate = jest.fn();
  const confirmUpdate = jest.fn().mockReturnValue(true);

  expect(promptForAppUpdate(applyUpdate, confirmUpdate)).toBe(true);
  expect(confirmUpdate).toHaveBeenCalledWith(UPDATE_MESSAGE);
  expect(applyUpdate).toHaveBeenCalledTimes(1);
});

it('keeps the current client after user rejection', () => {
  const applyUpdate = jest.fn();

  expect(promptForAppUpdate(applyUpdate, () => false)).toBe(false);
  expect(applyUpdate).not.toHaveBeenCalled();
});
