export const USER_COUNT_UPDATED = 'server/user_count_updated';

export const userCountUpdated = (userCount) => ({
  type: USER_COUNT_UPDATED,
  userCount,
})
