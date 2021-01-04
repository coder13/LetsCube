import io from 'socket.io-client';
import * as Protocol from '../../lib/protocol';

const dev = process.env.NODE_ENV === 'development';
const makeURI = () => (dev ? `http://${document.location.hostname}:9000/` : '/');

Error.stackTraceLimit = Infinity;

// Socket manager
export default class Socket {
  constructor(props) {
    if (props.onChange) this.onChange = props.onChange;
    if (props.onError) this.onError = props.onError;
    if (props.onConnected) this.onConnected = props.onConnected;
    if (props.onDisconnected) this.onDisconnected = props.onDisconnected;
    this.onReconnect = props.onReconnect;

    this.events = props.events;
    this.socket = null;
  }

  // attempt to connect to server
  connect = () => {
    // Connect
    this.socket = io(makeURI(), {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      'force new connection': false,
    });

    // this.socket.connect();

    this.socket.on(Protocol.CONNECT, this._onConnected);
    this.socket.on(Protocol.DISCONNECT, this.onDisconnected);
    this.socket.on(Protocol.CONNECT_ERR, this.onError);
    this.socket.on(Protocol.RECONNECT_ERR, this.onError);
    this.socket.on(Protocol.reconnect, this.onReconnect);

    // Set listeners
    Object.keys(this.events).forEach((event) => {
      this.socket.on(event, this.events[event]);
    });
  };

  // Received connect event from socket
  _onConnected = () => {
    // eslint-disable-next-line no-console
    console.log('[SOCKET.IO]', Protocol.CONNECT);
    if (this.onConnected) {
      this.onConnected();
    }
  }

  // Received disconnect event from socket
  onDisconnected = () => {
    // eslint-disable-next-line no-console
    console.log('[SOCKET.IO]', Protocol.DISCONNECT);
    if (this.onDisconnected) {
      this.onDisconnected();
    }
  }

  // Close the socket
  disconnect = () => this.socket.close();

  // Received error from socket
  onError = (message) => {
    // eslint-disable-next-line no-console
    console.log('[SOCKET.IO]', 'error', message);
  };

  emit = (event, ...args) => {
    this.socket.emit(event, ...args)
  };
}
