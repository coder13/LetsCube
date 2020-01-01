import * as Protocol from '../../lib/protocol.js';
import io from 'socket.io-client';

// Socket manager
export default class Socket {
  constructor(props) {
    this.onChange = props.onChange;
    this.onSocketError = props.onSocketError;
    this.onMessage = props.onMessage;
    this.onUpdateRooms = props.onUpdateRooms;
    this.socket = null;
    this.user = null;
    this.port = null;
  }

  // attempt to connect to server
  connect = () => {
    // Connect
    const host = `http://${document.location.hostname}:9000`;
    this.socket = io.connect(host);

    // Set listeners
    this.socket.on(Protocol.CONNECT, this.onConnected);
    this.socket.on(Protocol.DISCONNECT, this.onDisconnected);
    this.socket.on(Protocol.CONNECT_ERR, this.onError);
    this.socket.on(Protocol.RECONNECT_ERR, this.onError);
  };

  // Received connect event from socket
  onConnected = () => {
    this.socket.on(Protocol.MESSAGE, this.onMessage);
    this.socket.on(Protocol.UPDATE_ROOMS, this.onUpdateRooms);
    this.onChange(true);
  };

  // Received disconnect event from socket
  onDisconnected = () => this.onChange(false);

  // Send a message over the socket
  sendMessage = message => this.socket.emit(Protocol.MESSAGE, message);

  // Close the socket
  disconnect = () => this.socket.close();

  // Received error from socket
  onError = message  => {
    this.onSocketError(message);
    this.disconnect();
  };
}