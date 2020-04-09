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

const url = () => (document.location.hostname === 'localhost' ? '/api/me' : '/api/me');

export const fetchUser = () => (dispatch) => {
  dispatch(fetchingUser());
  return fetch(url())
    .then((res) => res.json())
    .then((data) => dispatch(userChanged(data)))
    .catch(() => {
      console.error('Could not Fetch User');
    });
};
