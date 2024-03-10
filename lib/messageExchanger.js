const net = require('net');
const crypto = require('crypto');
const handshake = require('./handshake.js');
const fs = require('fs');
const path = require('path');
const express = require('express');
const https = require('https');
const http = require('http');
const bodyParser = require('body-parser');
const events = require('events');


const DEFAULT_PORT=3600;
const CERT_PORT=3601;

class MessageExchanger {
  app;
  certApp = express();
  #port;
  #certPort;
  #e = new events.EventEmitter();
  #blockListPath = path.join(__dirname+"/../", '.ignoreList.json');
  #blockList = [];
  #sslCACerts = {};
  #sslDir = path.join(__dirname+"/../", 'ssl');
  #name;

  constructor(name, port=DEFAULT_PORT, certPort=CERT_PORT) {
    this.#name = name;
    this.#port = port;
    this.#certPort = certPort
    this.app = express();

    if (!fs.existsSync(this.#blockListPath)) {
      fs.writeFileSync(this.#blockListPath, JSON.stringify([]), 'utf-8');
    } else {
      this.#blockList = JSON.parse(fs.readFileSync(this.#blockListPath, 'utf-8'));
    }

    this.initializeHttpsServer();
    this.initializeHttpServer();
  }

  initializeHttpsServer() {
    this.app.use(bodyParser.json());
    this.app.use((req, res, next) => this.#blockRoutes(req, res, next));

    this.app.post('/post', async (req, res) => {
      const { name, message, signature } = req.body;
      if (!message) {
        return res.status(400).send({ error: 'Message is required' });
      }
      else if (!name) {
        return res.status(400).send({ error: 'Name is required' });
      }
      else if (!signature) {
        return res.status(400).send({ error: 'Name is required' });
      }
      if(!this.#sslCACerts[name]) {
        if(!await this.getCert(name, await handshake(name))) {
          return res.status(400).send({ error: 'You are not using a valid client.' });
        }
      }
      let verified=this.verifySignature(name,message,signature);
      this.#trigger('msg', {name, message, signature, verified});
      res.status(200).send({ message: 'Message received successfully' });
    });

    const sslOptions = {
      key: fs.readFileSync(path.join(this.#sslDir, `${this.#name}.key`)),
      cert: fs.readFileSync(path.join(this.#sslDir, `${this.#name}.crt`)),
    };

    https.createServer(sslOptions, this.app).listen(this.#port,"::", () => {
      this.#trigger('console', `HTTPS server listening at https://0.0.0.0:${this.#port}`);
    });
  }

  initializeHttpServer() {
    this.certApp.use((req, res, next) => this.#blockRoutes(req, res, next));
    this.certApp.get('/cert', (req, res) => {
      res.sendFile(path.join(this.#sslDir, `${this.#name}.crt`)); 
      this.#trigger('console', `HTTP certificate downloaded by ${req.ip}`);
    });
    this.certApp.listen(this.#certPort, "::", () => { 
      this.#trigger('console', `HTTP certificate server listening at http://0.0.0.0:${this.#certPort}`);
    });
  }

  #blockRoutes(req, res, next) {
    const clientIP = req.ip;
    if (this.#blockList.includes(clientIP)) {
      res.status(403).send('Access restricted.');
    } else {
      next();
    }
  }
  #saveBlockList() {
    fs.writeFileSync(this.#blockListPath, JSON.stringify(this.#blockList), 'utf-8');
  }
  addBlock(ip) {
    if (!ip || this.#blockList.includes(ip)) return false;
    if(!net.isIPv6(ip) && !net.isIPv4(ip)) return false;

    this.#blockList.push(ip);
    this.#saveBlockList();
    return true;
  }
  addBlockByName(name) {
    if(!name) return false;
    if(!this.#sslCACerts[name]) return false;
    return this.addBlock(this.#sslCACerts[name].ip.replace("[","").replace("]",""));     
  }
  delBlockByName(name) {
    if(!name) return false;
    if(!this.#sslCACerts[name]) return false;
    return this.delBlock(this.#sslCACerts[name].ip.replace("[","").replace("]",""));     
  }
  delBlock(ip) {
    const initialLength = this.#blockList.length;
    if(!net.isIPv6(ip) && !net.isIPv4(ip)) return false;

    this.#blockList = this.#blockList.filter(b => b !== ip);
    if (initialLength !== this.#blockList.length) {
      this.#saveBlockList();
      return true;
    }
    return false;
  }
  getBlocks() {
    return this.#blockList;
  }
  isBlock(ip) {
    return this.#blockList.includes(ip);
  }
  async sendMessage(servername, message) {
    try {
      if(!this.#sslCACerts[servername]) {
        if(!await this.getCert(servername, await handshake(servername))) {
          return false;
        }
      }
      const targetUrl = `https://${this.#sslCACerts[servername].ip}:${this.#port}/post`;
      const agent = new https.Agent({
        ca: this.#sslCACerts[servername].ca
      });
      const response = await this.fetch(targetUrl, {
        method: 'POST',
        body: JSON.stringify({name:servername, message, signature:this.signMessage(message)}),
        headers: {
         'Content-Type': 'application/json',
         'Host': servername
        },
        agent: agent
      })

      if (response.ok) {
        return true;
      } else {
        this.#trigger('console',`Failed to send message: HTTP status ${response.status}`);
        return false;
      }
    } catch (error) {
      this.#trigger('console',`Failed to send message: ${error.message}`);
      return false;
    }
  }

  async fetch(...args) {
    const fetch_ = (await import('node-fetch')).default;
    return await fetch_(...args);
  }
  async getCert(name, parameterObj) {
    try {
      if(!parameterObj) {
        this.#trigger('console', `No Handshake data found for ${name}`);
        return false;
     }
      const expectedHash = parameterObj.cert;
      let ip = parameterObj.ip;
      if(net.isIPv6(ip))
        ip = `[${ip}]`;
      const certUrl = `http://${ip}:${this.#certPort}/cert`;
      const response = await this.fetch(certUrl);
      const data = await response.text();
      let serverCert = data.trim();
      let match = serverCert.match(/-----BEGIN CERTIFICATE-----\s*([\s\S]+?)\s*-----END CERTIFICATE-----/);
      if (!match) {
        this.#trigger('console', `Improper Certificate for ${name}`);
        return false;
      }
      let der = Buffer.from(match[1], 'base64');
      const hash = crypto.createHash('sha256').update(der).digest('hex');
      if (hash.toUpperCase() === expectedHash) {
        this.#sslCACerts[name] = { ip, ca: serverCert, hash };
        return true;
      } else {
        this.#trigger('console', `Certificate hash mismatch for IP: ${ip}`);
        return false;
      }
    } catch (error) {
      this.#trigger('console', `Failed to retrieve certificate for IP: ${ip}, error: ${error.message}`);
      return false;
    }
  }

  signMessage(message) {
    const privateKey = fs.readFileSync(path.join(this.#sslDir, `${this.#name}.key`), 'utf8');
    const sign = crypto.createSign('SHA256');
    sign.update(message);
    return sign.sign(privateKey, 'base64');
  }

  verifySignature(name, message, signature) {
    const certificate = this.#sslCACerts[name].ca;
    if(!certificate)
      return false;
    const verify = crypto.createVerify('SHA256');
    verify.update(message);
    return verify.verify(certificate, signature, 'base64');
  }

  on(type, func) {
    this.#e.addListener(type, func);
  }

  #trigger(...args) {
    this.#e.emit(...args);
  }
}

module.exports = MessageExchanger;


