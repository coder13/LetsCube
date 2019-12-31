import Socket from './Socket';
import {
  connectionChanged,
  CONNECT_SOCKET,
  DISCONNECT_SOCKET
} from './actions';
// import {
//   clientUpdateReceived,
//   messageReceived,
//   recipientChanged,
//   messageSent,
//   SEND_MESSAGE
// } from '../../message/actions';

const socketMiddleware = store => {
  // The socket's connection state changed
  const onConnectionChange = isConnected => {
    store.dispatch(connectionChanged(isConnected));
    // store.dispatch(statusChanged(isConnected ? 'Connected' : 'Disconnected'));
  };

  // There has been a socket error
  // const onSocketError = (status) => store.dispatch(statusChanged(status, true));
  const onSocketError = (status) => {
    console.log(25, status);
  };

  // The client has received a message
  // const onIncomingMessage = message => store.dispatch(messageReceived(message));
  const onIncomingMessage = message => {
    console.log(31, message);
  };

  const socket = new Socket(
    onConnectionChange,
    onSocketError,
    onIncomingMessage
  );

  // Return the handler that will be called for each action dispatched
  return next => action => {
    const messageState = store.getState().messageState;
    const socketState = store.getState().socketState;
    console.log(44, action)

    switch (action.type){
      case CONNECT_SOCKET:
        socket.connect();
        break;
      case DISCONNECT_SOCKET:
        socket.disconnect();
        break;
      // case SEND_MESSAGE:
      //   socket.sendMessage({
      //     message: messageState.message
      //   });
      //   store.dispatch(messageSent());
      //   break;
      default:
        break;
    }

    return next(action)
  };
};

export default socketMiddleware;