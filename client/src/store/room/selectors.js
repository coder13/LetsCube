import { createSelector } from 'reselect';
import {
  calculatePointsForAttempt,
  calculatePointsForAllAttempts,
} from '../../lib/stats';

const getInRoom = (state) => state.inRoom;
const getRegistered = (state) => state.registered;
const getUsers = (state) => state.users;
const getAttempts = (state) => state.attempts;

// eslint-disable-next-line import/prefer-default-export
export const getUsersInRoom = createSelector(
  [getInRoom, getUsers], (inRoom, users) => users.filter((user) => inRoom[user.id]),
);

// eslint-disable-next-line import/prefer-default-export
export const getRegisteredUsers = createSelector(
  [getRegistered, getUsers], (registered, users) => users.filter((user) => registered[user.id]),
);

export const getLeaderboard = createSelector(
  [getRegistered, getUsers, getAttempts],
  (registered, users, attempts) => calculatePointsForAllAttempts(attempts.map((attempt) => (
    calculatePointsForAttempt('grand_prix', attempt.results)
  ))),
);
