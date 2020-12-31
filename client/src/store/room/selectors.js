import { createSelector } from 'reselect';

const getInRoom = (state) => state.inRoom;
const getRegistered = (state) => state.registered;
const getUsers = (state) => state.users;

// eslint-disable-next-line import/prefer-default-export
export const getUsersInRoom = createSelector(
  [getInRoom, getUsers], (inRoom, users) => users.filter((user) => inRoom[user.id]),
);

// eslint-disable-next-line import/prefer-default-export
export const getRegisteredUsers = createSelector(
  [getRegistered, getUsers], (registered, users) => users.filter((user) => registered[user.id]),
);
