const UPDATE_MESSAGE = 'A new version of Let\'s Cube is ready. Reload now?';

export const promptForAppUpdate = (
  applyUpdate,
  confirmUpdate = (message) => window.confirm(message),
) => {
  if (confirmUpdate(UPDATE_MESSAGE)) {
    applyUpdate();
    return true;
  }
  return false;
};

export { UPDATE_MESSAGE };
