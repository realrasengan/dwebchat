const { fetch } = require('./utils.js');
const net = require('net');
const crypto = require('crypto');
const handshake = require('./handshake.js');
const path = require('path');
const express = require('express');
const http = require('http');
const events = require('events');

const CERT_PORT=3601;

class CertManager {
  #certApp;
  #certPort;
  #e = new events.EventEmitter();
  #sslCACerts = {};
  #sslDir = path.join(__dirname+"/../", 'ssl');
  #name;

  constructor(name, blocks) {
    this.#name = name;
    this.#certPort = CERT_PORT
    this.#certApp = express();
    this.blocks = blocks;
    this.initializeHttpServer();
  }

  initializeHttpServer() {
    this.#certApp.use((req, res, next) => this.blocks.blockRoutes(req, res, next));
    this.#certApp.get('/cert', (req, res) => {
      res.sendFile(path.join(this.#sslDir, `${this.#name}.crt`)); 
      this.#trigger('console', `HTTP certificate downloaded by ${req.ip}`);
    });
    this.#certApp.listen(this.#certPort, "::", () => { 
      this.#trigger('console', `HTTP certificate server listening at http://0.0.0.0:${this.#certPort}`);
    });
  }

  async getCert(name) {
    if(this.#sslCACerts[name])
      return this.#sslCACerts[name];

    let parameterObj = await handshake(name);

    let controller = new AbortController();
    setTimeout(() => controller.abort(), 3000);
    try {
      if (!parameterObj) {
        this.#trigger('console', `No Handshake data found for ${name}`);
        return false;
      }
      const expectedHash = parameterObj.cert;
      let ip = parameterObj.ip;
      if (net.isIPv6(ip)) ip = `[${ip}]`;
      const certUrl = `http://${ip}:${this.#certPort}/cert`;
      const response = await fetch(certUrl, { signal: controller.signal });
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
        return this.#sslCACerts[name];
      } else {
        this.#trigger('console', `Certificate hash mismatch for IP: ${ip}`);
        return false;
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        this.#trigger('console', `Certificate retrieval timed out for ${name}`);
      } else {
        this.#trigger('console', `Failed to retrieve certificate for ${name}, error: ${error.message}`);
      }
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

module.exports = CertManager;


