const net = require('net');
const fs = require('fs');
const Client = require('./client.js');
const TempClient = require('./tempclient.js');
const MessageExchanger = require('./message.js');
const { verifySignature, extractMessageWithTimestamp, isTimestampValid } = require('./utils.js');

class IRCServer {
  #server;
  #port;
  #clients;
  #MSG;
  #nick;
  #user;
  #realName;
  constructor(port, sslDirectory) {
    this.#port = port;
    this.#clients = [];
    this.#determineName(sslDirectory).then(name => {
      this.#nick = name;
      this.#server = net.createServer((socket) => this.#clientListener(socket));
      this.#server.listen(this.#port, 'localhost', () => {
        console.log(`Server listening on port ${this.#port}`);
      });
      this.#initializeMessageExchanger(this.#nick);
    }).catch(err => {
      console.error('Server initialization error:', err);
      process.exit(1);
    });
  }
  #initializeMessageExchanger(nick) {
    this.#MSG = new MessageExchanger(nick);
    this.#MSG.on('msg',async (msg) => {
      switch(msg.type) {
        case 'privmsg':
          this.#processMessage(msg);
          break;
        case 'notice':
          this.#processNotice(msg);
          break;
        case 'whois':
          this.#processWhois(msg);
          break;
        case 'whoisr':
          this.#processWhoisResponse(msg);
          break;
        case 'join':
          this.#processJoin(msg);
          break;
        case 'part':
          this.#processPart(msg);
          break;
        case 'msg':
          await this.#processMsg(msg);
          break;
        case 'names':
          this.#processNames(msg);
          break;
        default:
          break;
      }
    });
    this.#MSG.on('console',(msg) => {
      console.log(msg);
    });
  }
  async #determineName(sslDirectory) {
    try {
      const files = fs.readdirSync(sslDirectory);
      const commonNames = files.map(file => file.split('.')[0]);
      const uniqueNames = new Set(commonNames);
      if (uniqueNames.size === 1) {
        const commonName = uniqueNames.values().next().value;
        return commonName;
      } else if(uniqueNames.size === 0) {
        throw new Error('First run setup.sh');
      } else {
        throw new Error('Multiple common names found');
      }
    } catch (err) {
      console.error('Error:', err.message);
      throw err;
    }
  }
  #clientListener(socket) {
    const tempClient = new TempClient(socket, (nick, user, realName, tempClientInstance) => {
      if (nick.toLowerCase() !== this.#nick.toLowerCase()) {
        socket.write("ERROR :Closing Link: Nickname does not match handshake name [Disconnecting]\r\n");
        socket.end();
        this.#removeTempClient(tempClientInstance);
        return;
      }
      this.#realName = realName;
      this.#user = user;
      const client = new Client(socket, this, nick, user, realName);
      client.initialize();
      this.#add(client);
      socket.client=client;
      this.#removeTempClient(tempClientInstance);
    });
    socket.on('close', () => {
      if(socket.client)
        this.#remove(socket.client);
    });
  }
  #add(client) {
    this.#clients.push(client);
  }
  #remove(client) {
    const index = this.#clients.indexOf(client);
    if (index !== -1) {
      this.#clients.splice(index, 1);
    }
  }
  #removeTempClient(tempClient) {
    tempClient = null;
  }

  #processMessage(msg) {
    this.broadcast(`:${msg.name} PRIVMSG ${this.#nick} :${msg.message}`); 
  }
  #processNotice(msg) {
    this.broadcast(`:${msg.name} NOTICE ${this.#nick} :${msg.message}`); 
  }
  #processJoin(msg) {
    this.broadcast(`:${msg.name} JOIN :#${msg.channel}`);
  }
  #processPart(msg) {
    this.broadcast(`:${msg.name} PART :#${msg.channel}`);
  }
  async #processMsg(msg) {
    let cert = await this.#MSG.getCert(msg.name);
    if(!cert) {
      return;
    }
    let verified=verifySignature(msg.name,msg.message,msg.signature,cert.ca);
    let m = extractMessageWithTimestamp(msg.message);
    if(verified && isTimestampValid(m.timestamp)) {
      this.broadcast(`:${msg.name} PRIVMSG #${msg.channel} :${m.message.substr(m.message.indexOf(' ')+1)}`);
    } else {
      console.log("unverified");
    }
  }
  #processNames(msg) {
    this.broadcast(`:* 332 ${this.#nick} #${msg.channel} :Topic Unavailable`);
    this.broadcast(`:* 333 ${this.#nick} #${msg.channel} null :0`);

    let names=[];
    for(let x=0;x<msg.names.length;x++) {
      if(x%53==0 && names.length>0) {
        this.broadcast(`:* 353 ${this.#nick} = #${msg.channel} :${names.join(" ")}`);
        names=[];
      }
      names.push(msg.names[x]);
    }
    if(names.length>0)
      this.broadcast(`:* 353 ${this.#nick} = #${msg.channel} :${names.join(" ")}`);

    this.broadcast(`:* 366 ${this.#nick} #${msg.channel} :End of /NAMES list.`);
  }
  async #processWhois(msg) {
    try {
      let response = await this.#MSG.sendMessage(msg.name,JSON.stringify({user:this.#user,realName:this.#realName}),msg.type+'r');
      if(response)
        return true;
      else
        throw new Error(`Unexpected response for whois to ${msg.name}`);
    } catch(error) {
      throw new Error(`Unable to send whois message to ${msg.name}: ${error}`);
    }
  }
  async #processWhoisResponse(msg) {
    const response = JSON.parse(msg.message);
    this.broadcast(`:* 311 ${this.#nick} ${msg.name} ${response.user} * * :* ${response.realName}`);
    this.broadcast(`:* 312 ${this.#nick} ${msg.name} irc :irc-0.1-dalvenjah`);
    this.broadcast(`:* 318 ${this.#nick} ${msg.name} :End of /WHOIS list.`);
  }
  
  async handleJoin(target) {
    target=target.substr(1);
    let [servername, channelName] = target.split('/');
    if (!channelName) {
      channelName = servername;
    }

    if(!await this.#MSG.sendMessageWs(servername, channelName, 'join')) {
      this.broadcast(`:* 473 {$this.#nick} ${channelName} :Cannot join channel (Can't reach server?)`);
    }
  }
  async handleNames(target) {
    target=target.substr(1);
    let [servername, channelName] = target.split('/');
    if (!channelName) {
      channelName = servername;
    }
    if(!await this.#MSG.sendMessageWs(servername, channelName, 'names')) {
      this.broadcast(`ERROR: Can't reach server?`);      
    }
  }
  async handlePart(target) {
    target=target.substr(1);
    let [servername, channelName] = target.split('/');
    if (!channelName) {
      channelName = servername;
    }
    if(!await this.#MSG.sendMessageWs(servername, channelName, 'part')) {
      this.broadcast(`ERROR: Can't reach server?`);      
    }
  }

  async handleWhois(target) {
    try {
      let response = await this.#MSG.sendMessage(target, 'whois', 'whois');
      if(response) {
        return true;
      }
      else {
        this.broadcast(`:* 401 ${this.#nick} ${target} :No such nick`);
        this.broadcast(`:* 318 ${this.#nick} ${target} :End of /WHOIS list.`);
      }
    } catch(error) { 
      throw new Error(`Unable to whois ${target}: ${error}`);
    }
  }
  async handlePrivmsgToChannel(channel, message) {
    channel = channel.substr(1);
    let [servername, channelName] = channel.split('/');
    if(!channelName) {
      channelName = servername;
    }
    if(!await this.#MSG.sendMessageWs(servername, `${channelName} ${message}`, 'message')) {
      console.log("An error occurred msging channel");
    }
  }
  async handlePrivmsgToNick(sender, target, message) {
    try {
      let response = await this.#MSG.sendMessage(target, message, 'privmsg');
      if(response) {
        this.broadcastButOne(sender,`:${this.#nick} PRIVMSG ${target} :${message}`);
        return true;
      }
      else
        this.broadcast(`:* 401 ${this.#nick} ${target} :No such nick`);
    } catch(error) {
      throw new Error(`Unable to send message to ${target}: ${error}`);
    }
  }
  async handleNoticeToNick(sender, target, message) {
    try {
      let response = await this.#MSG.sendMessage(target, message, 'notice');
      if(response) {
        this.broadcastButOne(sender, `:${this.#nick} NOTICE ${target} :${message}`);
        return true;
      }
      else
        this.broadcast(`:* 401 ${this.#nick} ${target} :No such nick`);
    } catch(error) {
      throw new Error(`Unable to send notice to ${target}: ${error}`);
    }
  }
  handleQuit(message) {
    process.exit(0);
  }

  broadcast(message) {
    this.#clients.forEach((client) => client.sendMessage(message));
  }
  broadcastButOne(cclient, message) {
    this.#clients.forEach((client) => {
      if(client!=cclient)
        client.sendMessage(message);
    });
  }

}
module.exports = IRCServer;
