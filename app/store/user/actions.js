export const USER_CHANGED = 'user/changed';
export const USER_FETCHING = 'user/fetching';

export const userChanged = user => ({
  type: USER_CHANGED,
  fetching: false,
  user
})

export const fetchingUser = () => ({
  type: USER_FETCHING,
  fetching: true
});

export const fetchUser = () =>
  dispatch => {
    dispatch(fetchingUser());
    return fetch('/api/me')
      .then(res => res.json())
      .then(data => dispatch(userChanged(data)))
  }
