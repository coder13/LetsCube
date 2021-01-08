import lcFetch from '../../lib/fetch';

export const USER_CHANGED = 'user/changed';
export const USER_FETCHING = 'user/fetching';
export const UPDATE_PROFILE = 'user/update_profile';

export const userChanged = (user) => ({
  type: USER_CHANGED,
  fetching: false,
  user,
});

export const fetchingUser = () => ({
  type: USER_FETCHING,
  fetching: true,
});

/* Update parts to a whole of a profile */
export const updateProfile = (profile) => ({
  type: UPDATE_PROFILE,
  profile,
});

export const fetchUser = () => (dispatch) => {
  dispatch(fetchingUser());
  return lcFetch('/api/me')
    .then((res) => {
      if (!res.ok) {
        throw new Error(res.statusCode);
      }

      return res.json();
    })
    .then((data) => dispatch(userChanged(data)))
    .catch(() => {
      dispatch(userChanged());
    });
};
