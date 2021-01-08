/* Customized history preserving `port` query parameter on location change. */

import { createBrowserHistory } from 'history';

const preserveQueryParams = (history, location) => {
  const query = new URLSearchParams(history.location.search);
  const newQuery = new URLSearchParams(location.search);

  if (query.has('port')) {
    newQuery.set('port', query.get('port'));
  }

  return {
    ...location,
    search: newQuery.toString(),
  };
};

const createLocationObject = (path, state) => (
  typeof path === 'string' ? { pathname: path, state } : path
);

const history = createBrowserHistory();

const originalPush = history.push;
history.push = (path, state) => (
  originalPush.apply(history, [
    preserveQueryParams(history, createLocationObject(path, state)),
  ])
);

const originalReplace = history.replace;
history.replace = (path, state) => (
  originalReplace.apply(history, [
    preserveQueryParams(history, createLocationObject(path, state)),
  ])
);

export default history;
