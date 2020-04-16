export const NEW_MESSAGE = 'messages/new';
export const CLOSE_MESSAGE = 'messages/close';

export const createMessage = (message) => ({
  type: NEW_MESSAGE,
  message,
});

export const closeMessage = (index) => ({
  type: CLOSE_MESSAGE,
  index,
});
