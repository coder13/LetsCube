import { createSelector } from 'reselect';

const getInRoom = (state) => state.inRoom;
const getUsers = (state) => state.users;

// eslint-disable-next-line import/prefer-default-export
export const getUsersInRoom = createSelector(
  [getInRoom, getUsers], (inRoom, users) => users.filter((user) => inRoom[user.id]),
);
