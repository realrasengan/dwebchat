class ChannelManager {
  constructor(server, WebSocket) {
    this.channels = {};
    this.server = server;
    this.WebSocket = WebSocket;
  }

  channelExists(name) {
    return !!this.channels[name];
  }
  canCreateChannel(name) {
    return name === this.server;
  }
  create(name) {
    if (!this.channels[name]) {
      this.channels[name] = new Set();
    }
  }

  addUserToChan(channel, ws) {
    if (!this.channelExists(channel)) {
      if (this.canCreateChannel(ws.nick)) {
        this.create(channel);
        this.channels[channel].add(ws);
        return true;
      } else {
        return false;
      }
    } else {
      this.channels[channel].add(ws);
      return true;
    }
  }

  removeUserFromChan(name, ws) {
    if (this.channels[name]) {
      this.channels[name].delete(ws);
      if (this.channels[name].size === 0) {
        delete this.channels[name];
      }
    }
  }
  removeUserFromAllChannels(ws) {
    Object.keys(this.channels).forEach(channelName => {
      const channel = this.channels[channelName];
      if (channel.has(ws)) {
        channel.delete(ws);
        if (channel.size === 0) {
          delete this.channels[channelName];
        }
      }
    });
  }

  broadcastMessage(name, message, senderWs = null) {
    const channel = this.channels[name];
    if (channel) {
      channel.forEach(clientWs => {
        if (clientWs.readyState === this.WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'message', message }));
        }
      });
    }
  }
  broadcastMessageButOne(name, message, senderWs = null) {
    const channel = this.channels[name];
    if (channel) {
      channel.forEach(clientWs => {
        if (clientWs !== senderWs && clientWs.readyState === this.WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'message', message }));
        }
      });
    }
  }

  getNames(channelName) {
    const names = [];
    const channel = this.channels[channelName];
    if (channel) {
      channel.forEach(ws => {
        if (ws.nick) {
          names.push(ws.nick);
        }
      });
    }
    return names;
  }

}

module.exports = ChannelManager;
