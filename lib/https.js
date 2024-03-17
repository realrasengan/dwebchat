const { fetch, signMessage, verifySignature, extractMessageWithTimestamp, isTimestampValid } = require('./utils.js');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const express = require('express');
const https = require('https');
const bodyParser = require('body-parser');
const events = require('events');
const ChannelManager = require('./channel.js');

const DEFAULT_PORT=3600;

class HttpsServer {
  app;
  #e;
  #sslDir;
  #name;
  #cm;
  #channelManager;
  #httpsServer;

  constructor(name, cm, blocks) {
    this.#name = name;
    this.#cm = cm;
    this.blocks = blocks;

    this.app = express();
    this.#e = new events.EventEmitter();
    this.#sslDir = path.join(__dirname+"/../", 'ssl');

    this.#channelManager = new ChannelManager(this.#name, WebSocket);

    this.#httpsServer = this.initializeHttpsServer();
    this.initializeWebSocketServer(this.#httpsServer);
  }

  initializeHttpsServer() {
    this.app.use(bodyParser.json());
    this.app.use((req, res, next) => this.blocks.blockRoutes(req, res, next));

    this.app.post('/post', async (req, res) => {
      const { name, type,  message, signature } = req.body;
      if (!message) {
        return res.status(400).send({ error: 'Message is required' });
      }
      else if (!name) {
        return res.status(400).send({ error: 'Name is required' });
      }
      else if (!signature) {
        return res.status(400).send({ error: 'Name is required' });
      }
      let cert = await this.#cm.getCert(name);
      if(!cert)
        return res.status(400).send({ error: 'You are not using a valid client.' });
      let verified=verifySignature(name,message,signature,cert.ca);
      let m = extractMessageWithTimestamp(message);
      if(verified && isTimestampValid(m.timestamp)) {
        this.#trigger('msg', {name, type, message:m.message, verified});
        res.status(200).send({ message: 'Message received successfully' });
      }
      else {
        return res.status(400).send({ error: 'Not verified!' });
      }
    });

    const sslOptions = {
      key: fs.readFileSync(path.join(this.#sslDir, `${this.#name}.key`)),
      cert: fs.readFileSync(path.join(this.#sslDir, `${this.#name}.crt`)),
    };
    const httpsServer = https.createServer(sslOptions, this.app);

    httpsServer.listen(DEFAULT_PORT,"::", () => {
      this.#trigger('console', `HTTPS server listening at https://0.0.0.0:${DEFAULT_PORT}`);
    });

    return httpsServer;
  }
  initializeWebSocketServer(httpsServer) {
    this.wss = new WebSocket.Server({ noServer: true });

    const upgradeHandler = (request, socket, head) => {
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.handleWebSocketConnection(ws, request);
      });
    };
    httpsServer.on('upgrade', upgradeHandler);
  }
  handleWebSocketConnection(ws, request) {
    ws.on('message', async (data) => {
      try {
        const { type, name, message, signature } = JSON.parse(data);
        let cert = await this.#cm.getCert(name);
        if(!cert) {
          ws.send(JSON.stringify({ error: 'Invalid client' }));
          return;
        }
        let verified=verifySignature(name,message,signature,cert.ca);
        let m = extractMessageWithTimestamp(message);
        if(verified && isTimestampValid(m.timestamp)) {
          ws.nick=name;
          switch (type) {
            case 'join':
              if(this.#channelManager.addUserToChan(m.message, ws)) {
                this.#channelManager.broadcastMessage(m.message, JSON.stringify({ channel: m.message, name: name, type: 'join' }), ws);
                ws.send(JSON.stringify({ type: 'names', channel: m.message, names: this.#channelManager.getNames(m.message) }));
              } else {
                ws.send(JSON.stringify({ error: 'Cannot join channel' }));
              }
              break;
            case 'part':
              this.#channelManager.broadcastMessage(m.message, JSON.stringify({channel: m.message, name:name,type:'part'}), ws);
              this.#channelManager.removeUserFromChan(m.message, ws);
              break;
            case 'message':
              let target=message.split(' ')[0];
              let msg=message.substr(message.indexOf(' ')+1);
              this.#channelManager.broadcastMessageButOne(target, JSON.stringify({channel: target, name:name,type:'msg',message:message,signature}), ws);
              break;
            case 'names':
              ws.send(JSON.stringify({ type: 'names', channel: m.message, names: this.#channelManager.getNames(m.message) }));
              break;
            default:
              ws.send(JSON.stringify({ error: 'Unknown type' }));
              break;
          }
        } else {
          ws.send(JSON.stringify({ error: 'Authentication failed or message timestamp invalid.' }));
          return;
        }
      } catch (err) {
        ws.send(JSON.stringify({ error: 'Error processing your message.' }));
      }
    });
    ws.on('close', () => {
      this.#channelManager.removeUserFromAllChannels(ws);
    });
  }

  on(type, func) {
    this.#e.addListener(type, func);
  }

  #trigger(...args) {
    this.#e.emit(...args);
  }

}

module.exports = HttpsServer;


