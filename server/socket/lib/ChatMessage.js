const uuid = require('uuid/v4');

class ChatMessage {
  constructor(message, userId) {
    this.id = uuid();
    this.timestamp = Date.now();
    this.text = message;
    this.userId = userId;
  }
}

module.exports = ChatMessage;
