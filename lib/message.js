const { fetch, signMessage, verifySignature, extractMessageWithTimestamp, isTimestampValid } = require('./utils.js');
const https = require('https');
const CertManager = require('./certs.js');
const WebSocket = require('ws');
const net = require('net');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const events = require('events');
const Blocks = require('./blocks.js');
const HttpsServer = require('./https.js');

const DEFAULT_PORT=3600;

class MessageExchanger {
  #cm;
  #httpsServer;
  #blocks;
  #e;
  #name;
  #privatekey;
  #wsClients;

  constructor(name) {
    this.#e = new events.EventEmitter();
    this.#name = name;
    this.#blocks = new Blocks();
    this.#privatekey=fs.readFileSync(path.join(path.join(__dirname+"/../", 'ssl'), `${this.#name}.key`),'utf8');

    this.#wsClients = {};
    this.#name = name;

    this.#cm = new CertManager(name, this.#blocks);
    this.#cm.on('console',(msg)=>{ this.#trigger('console', msg); })

    this.httpsServer = new HttpsServer(name, this.#cm, this.#blocks);
    this.httpsServer.on('msg',(message)=>{
      this.#trigger('msg', message);
    });
    this.httpsServer.on('console',(message)=> {
      this.#trigger('console',message);
    });
  }

  async getCert(name) { return await this.#cm.getCert(name) }
  async connectToWebSocketServer(servername) {
    if(this.#wsClients[servername])
      return this.#wsClients[servername];
    let cert = await this.#cm.getCert(servername);
    if(!cert)
      return false;

    const targetUrl = `wss://${cert.ip}:${DEFAULT_PORT}/`;
    const agent = new https.Agent({
      ca: cert.ca
    });


    return new Promise((resolve) => {
      const wsClient = new WebSocket(targetUrl, { agent, servername });

      wsClient.on('open', () => {
        this.#trigger('console',`Connected to WebSocket server at ${targetUrl}`);
        this.#wsClients[servername] = wsClient;
        resolve(wsClient);
      });

      wsClient.on('error', (error) => {
        this.#trigger('console',`WebSocket error for ${servername}: ${error.message}`);
        resolve(false);
      });

      wsClient.on('close', () => {
        this.#trigger('console',`Disconnected from WebSocket server at ${targetUrl}`);
        delete this.#wsClients[servername];
      });

      wsClient.on('message', (data) => {
        try {
          const _message = JSON.parse(data);
          let message;
          if(_message.message)
            message = JSON.parse(_message.message);
          else
            message = _message;
          switch (message.type) {
            case 'join':
            case 'part':
            case 'msg':
              this.#trigger('msg', message);
              break;
            case 'names':
              this.#trigger('msg', {type:'names',channel:message.channel, names:message.names});
              break;
          }
        } catch (err) {
          this.#trigger('console',`Error processing incoming message: ${err}`);
        }
      });
    });
  }
  async sendMessageWs(servername, message, type) {
    if(!this.#wsClients[servername]) {
      if(!await this.connectToWebSocketServer(servername))
        return false;
    }
    const wsClient = this.#wsClients[servername];
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      message+=` ${Date.now()}`;
      wsClient.send(JSON.stringify({ name: this.#name, message, type, signature: signMessage(message, this.#privatekey)}));
      return true;
    } else {
      this.#trigger('console',`WebSocket connection to ${servername} is not open.`);
      return false;
    }
  }

  async sendMessage(servername, message, type) {
    try {
      let cert = await this.#cm.getCert(servername);
      if (!cert)
        return false;

      const targetUrl = `https://${cert.ip}:${DEFAULT_PORT}/post`;
      const agent = new https.Agent({
        ca: cert.ca
      });

      const fetchTimeout = new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('Request timed out')), 3000);
      });

      message+=` ${Date.now()}`;
      const fetchPromise = fetch(targetUrl, {
        method: 'POST',
        body: JSON.stringify({ name: this.#name, message, type, signature: signMessage(message, this.#privatekey) }),
        headers: {
          'Content-Type': 'application/json',
          'Host': servername
        },
        agent: agent
      });

      const response = await Promise.race([fetchPromise, fetchTimeout]);

      if (response.ok) {
        return true;
      } else {
        this.#trigger('console', `Failed to send message: HTTP status ${response.status}`);
        return false;
      }
    } catch (error) {
      this.#trigger('console', `Failed to send message: ${error.message}`);
      return false;
    }
  }

  on(type, func) {
    this.#e.addListener(type, func);
  }

  #trigger(...args) {
    this.#e.emit(...args);
  }

}

module.exports = MessageExchanger;


