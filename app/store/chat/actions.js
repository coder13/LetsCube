export const SEND_CHAT = 'chat/send_chat';
export const RECEIVE_CHAT = 'chat/receive_chat';

export const sendChat = (message) => ({
  type: SEND_CHAT,
  message,
});

export const receiveChat = (message) => ({
  type: RECEIVE_CHAT,
  message,
});
