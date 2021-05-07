import { Manager } from 'socket.io-client';

const origin = () => process.env.REACT_APP_SOCKETIO_ORIGIN;

const manager = new Manager(`${origin()}:9000`, {
  withCredentials: true,
});

export default manager;
