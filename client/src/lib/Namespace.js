// import io from 'socket.io-client';
import * as Protocol from './protocol';

// const dev = process.env.NODE_ENV === 'development';
// const protocol = () => (dev ? 'http' : 'https');
const origin = () => process.env.REACT_APP_SOCKETIO_ORIGIN;
const makeURI = (port, namespace) => (
  `${origin()}${port ? `:${port}` : ''}${namespace}`
);

Error.stackTraceLimit = Infinity;

// Socket manager
export default class Namespace {
  constructor(props) {
    if (!props.namespace) {
      throw new Error('namespace required');
    }

    if (!props.manager) {
      throw new Error('manager required');
    }

    if (props.onChange) this.onChange = props.onChange;
    if (props.onError) this.onError = props.onError;
    if (props.onConnected) this.onConnected = props.onConnected;
    if (props.onDisconnected) this.onDisconnected = props.onDisconnected;
    if (props.onReconnect) this.onReconnect = props.onReconnect;

    this.manager = props.manager;
    this.namespace = props.namespace;
    this.events = props.events;
    this.socket = null;
    this.port = props.port;
  }

  // attempt to connect to server
  connect = () => {
    // Connect
    this.URI = makeURI(this.port || process.env.REACT_APP_SOCKETIO_PORT || '', this.namespace);

    this.socket = this.manager.socket(this.namespace);

    this.socket.on(Protocol.CONNECT, this._onConnected);
    this.socket.on(Protocol.DISCONNECT, this._onDisconnected);
    this.socket.on(Protocol.CONNECT_ERR, this._onError);

    // Set listeners
    Object.keys(this.events).forEach((event) => {
      this.socket.on(event, this.events[event]);
    });
  };

  // Received connect event from socket
  _onConnected = () => {
    // eslint-disable-next-line no-console
    console.log('[SOCKET.IO]', this.namespace, Protocol.CONNECT);
    if (this.onConnected) {
      this.onConnected();
    }
  }

  // Received disconnect event from socket
  _onDisconnected = () => {
    // eslint-disable-next-line no-console
    console.log('[SOCKET.IO]', this.namespace, Protocol.DISCONNECT);
    if (this.onDisconnected) {
      this.onDisconnected();
    }
  }

  // Close the socket
  disconnect = () => this.socket.close();

  // Received error from socket
  _onError = (message) => {
    // eslint-disable-next-line no-console
    console.error('[SOCKET.IO]', this.namespace, 'error', message);
  };

  emit = (event, ...args) => {
    this.socket.emit(event, ...args);
  };
}
