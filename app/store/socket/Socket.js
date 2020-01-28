import * as Protocol from '../../lib/protocol.js';
import io from 'socket.io-client';

const makeURI = () => `http://${document.location.hostname}:9000/`;

// Socket manager
export default class Socket {
  constructor(props) {
    this.onChange = props.onChange;
    this.onError = props.onError;
    this.events = props.events;
    this.socket = null;
  }

  // attempt to connect to server
  connect = () => {
    // Connect
    this.socket = io.connect(makeURI());

    this.socket.on(Protocol.CONNECT, this.onConnected);
    this.socket.on(Protocol.DISCONNECT, this.onDisconnected);
    this.socket.on(Protocol.CONNECT_ERR, this.onError);
    this.socket.on(Protocol.RECONNECT_ERR, this.onError);

    // Set listeners
    Object.keys(this.events).forEach(event => {
      this.socket.on(event, this.events[event]);
    })
  };

  // Received connect event from socket
  onConnected = () => {
    console.log('[SOCKET.IO]', Protocol.CONNECT);
    return this.onChange(true);
  }

  // Received disconnect event from socket
  onDisconnected = () => {
    console.log('[SOCKET.IO]', Protocol.DISCONNECT);
    return this.onChange(false);
  }

  // Close the socket
  disconnect = () => this.socket.close();

  // Received error from socket
  onError = message  => {
    // this.onSocketError(message);
    this.disconnect();
  };

  emit = (type, message) => {
    this.socket.emit(type, message);
  };
}