import * as Protocol from '../../lib/protocol.js';
import io from 'socket.io-client';

const makeURI = () => `http://${document.location.hostname}:9000/`;

// Socket manager
export default class Socket {
  constructor(props) {
    this.onChange = props.onChange;
    this.onSocketError = props.onSocketError;
    this.onMessage = props.onMessage;
    this.onUpdateRooms = props.onUpdateRooms;
    this.onUpdateRoom = props.onUpdateRoom;
    this.onRoomCreated = props.onRoomCreated;
    this.onForceJoin = props.onForceJoin;
    this.socket = null;
  }

  // attempt to connect to server
  connect = () => {
    // Connect
    this.socket = io.connect(makeURI());

    // Set listeners
    this.socket.on(Protocol.CONNECT, this.onConnected);
    this.socket.on(Protocol.DISCONNECT, this.onDisconnected);
    this.socket.on(Protocol.CONNECT_ERR, this.onError);
    this.socket.on(Protocol.RECONNECT_ERR, this.onError);

    this.socket.on(Protocol.UPDATE_ROOMS, this.onUpdateRooms);
    this.socket.on(Protocol.UPDATE_ROOM, this.onUpdateRoom);
    this.socket.on(Protocol.ROOM_CREATED, this.onRoomCreated);
    this.socket.on('force_join', this.onForceJoin);

    this.socket.on('join', function () {
      console.log(36, 'joined room', arguments);
    });
  };

  // Received connect event from socket
  onConnected = () => this.onChange(true);

  // Received disconnect event from socket
  onDisconnected = () => this.onChange(false);

  // Close the socket
  disconnect = () => this.socket.close();

  // Received error from socket
  onError = message  => {
    this.onSocketError(message);
    this.disconnect();
  };

  emit = (type, message) => {
    this.socket.emit(type, message);
  };
}