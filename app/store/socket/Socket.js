import io from 'socket.io-client';
import * as Protocol from '../../lib/protocol';

const dev = document.location.hostname !== 'letscube.calebhoover.com';
const makeURI = () => `${dev ? `http://${document.location.hostname}:9000` : 'https://letscube.calebhoover.com'}/`;

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
    console.log(19, 'connecting...', makeURI());
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
    console.log('[SOCKET.IO]', Protocol.CONNECT);
    if (this.onConnected) {
      this.onConnected();
    }
  }

  // Received disconnect event from socket
  onDisconnected = () => {
    console.log('[SOCKET.IO]', Protocol.DISCONNECT);
    if (this.onDisconnected) {
      this.onDisconnected();
    }
  }

  // Close the socket
  disconnect = () => this.socket.close();

  // Received error from socket
  onError = (message) => {
    console.log('[SOCKET.IO]', 'error', message);
  };

  emit = (type, message) => {
    this.socket.emit(type, message);
  };
}
