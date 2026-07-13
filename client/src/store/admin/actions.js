export const FETCH_ADMIN_DATA = 'admin/fetch_admin_data';
export const SET_ADMIN_DATA = 'admin/set_admin_data';
export const SEARCH_ADMIN_USERS = 'admin/search_users';
export const ANONYMIZE_ADMIN_USER = 'admin/anonymize_user';

export const fetchAdminData = () => ({
  type: FETCH_ADMIN_DATA,
});

export const setAdminData = (data) => ({
  type: SET_ADMIN_DATA,
  data,
});

export const searchAdminUsers = (query, onComplete) => ({
  type: SEARCH_ADMIN_USERS,
  query,
  onComplete,
});

export const anonymizeAdminUser = (userId, onComplete) => ({
  type: ANONYMIZE_ADMIN_USER,
  userId,
  onComplete,
});
