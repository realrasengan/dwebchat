const fs = require('fs');
const path = require('path');

class Blocks {
  #blockListPath = path.join(__dirname+"/../", '.ignoreList.json');
  #blockList = [];

  constructor() {
    if (!fs.existsSync(this.#blockListPath)) {
      fs.writeFileSync(this.#blockListPath, JSON.stringify([]), 'utf-8');
    } else {
      this.#blockList = JSON.parse(fs.readFileSync(this.#blockListPath, 'utf-8'));
    }
  }
  blockRoutes(req, res, next) {
    const clientIP = req.ip;
    if (this.isBlocked(clientIP)) {
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
  isBlocked(ip) {
    return this.#blockList.includes(ip);
  }
}

module.exports = Blocks;


