export const FETCH_USER = 'user/fetch'
export const USER_CHANGED = 'user/changed'
export const SOCKET_CONNECTED = 'socket/connected'
export const SOCKET_DISCONNECTED = 'socket/disconnected'

export const userChanged = user => {
  return {
    type: USER_CHANGED,
    user: user
  }
}

export function fetchUser () {
  return dispatch => 
    fetch(`/api/me`)
      .then(res => res.json())
      .then(data => dispatch(userChanged(data)))
}

export const socketConnected = () => {
  return {
    type: SOCKET_CONNECTED,
    connected: true
  }
}

export const socketDisconnected = () => {
  return {
    type: SOCKET_DISCONNECTED,
    connected: false
  }
}