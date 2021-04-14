export const FETCH_ADMIN_DATA = 'admin/fetch_admin_data';
export const SET_ADMIN_DATA = 'admin/set_admin_data';

export const fetchAdminData = () => ({
  type: FETCH_ADMIN_DATA,
});

export const setAdminData = (data) => ({
  type: SET_ADMIN_DATA,
  data,
});
