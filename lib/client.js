class Client {
  #nick;
  #user;
  #realName;
  #socket;
  #server;
  #buffer;
  constructor(socket, server, nick, user, realName) {
    this.#nick = nick;
    this.#user = user;
    this.#realName = realName;
    this.#socket = socket;
    this.#server = server;
    this.#buffer = '';
  }
  initialize() {
    this.#socket.on('data', this.onData.bind(this));
    this.sendMessage(`:* 001 ${this.#nick} :Welcome to irc ${this.#nick}`);
    this.sendMessage(`:* 002 ${this.#nick} :Your host is irc, running version irc-0.1-dalvenjah`);
    this.sendMessage(`:* 003 ${this.#nick} :This server was created ${this.#getFormattedStartTime()}`); 
    this.sendMessage(`:* 004 ${this.#nick} irc irc-0.1-dalvenjah `); // TODO: serv, channel, nick modes and 005
    this.sendMessage(`:* 375 ${this.#nick} :Message of the day`);
    this.sendMessage(`:* 372 ${this.#nick} :\t`);
    this.sendMessage(`:* 372 ${this.#nick} :This is in Alpha!`);
    this.sendMessage(`:* 372 ${this.#nick} :\t`);
    this.sendMessage(`:* 377 ${this.#nick} :End of message of the day.`);
  }
  onData(data) {
    this.#buffer += data.toString();
    let newlineIndex;
    while ((newlineIndex = this.#buffer.indexOf('\n')) !== -1) {
      const line = this.#buffer.substring(0, newlineIndex).trim();
      this.#buffer = this.#buffer.substring(newlineIndex + 1);
      this.processLine(line);
    }
  }
  processLine(line) {
    const [command, ...params] = line.split(' ');
    switch (command.toUpperCase()) {
      case "PRIVMSG":
        try {
          this.#handlePrivmsg(params);
        } catch(error) {
          console.log(`Privmsg Error: ${error}`);
        }
        break;
      case "NOTICE":
        try {
          this.#handleNotice(params);
        } catch(error) {
          console.log(`Notice Error: ${error}`);
        }
        break;
      case "WHOIS":
        try {
          this.#handleWhois(params);
        } catch(error) {
          console.log(`Whois Error: ${error}`);
        }
        break;
      case "JOIN":
        try {
          this.#handleJoin(params);
        } catch(error) {
          console.log(`Join Error: ${error}`);
        }
        break;
      case "PART":
        try {
          this.#handlePart(params);
        } catch(error) {
          console.log(`Join Error: ${error}`);
        }
        break;
      case "NAMES":
        try {
          this.#handleNames(params);
        } catch(error) {
          console.log(`Names error: ${error}`);
        }
        break;
      case "QUIT":
        this.#handleQuit(params);
        break;
      default:
        this.sendMessage(`:* 421 ${this.#nick} ${command.toUpperCase()} :Unknown command`);
        break;
    }
  }
  #handlePrivmsg(params) {
    const target = params[0];
    const message = this.#parseMessage(params.slice(1));
    if(target && message) {
      if (target.startsWith('#')) {
        this.#server.handlePrivmsgToChannel(target, message);
      } else {
        this.#server.handlePrivmsgToNick(this, target, message);
      }
    }
    else
      this.#sendNep('PRIVMSG');
  }
  #handleJoin(params) {
    const target = params[0];
    if(target && target.startsWith('#')) {
      this.#server.handleJoin(target);
    } else {
      this.#sendNep('JOIN');
    }
  }
  #handlePart(params) {
    const target = params[0];
    if(target && target.startsWith('#')) {
      this.#server.handlePart(target);
    } else {
      this.#sendNep('PART');
    }
  }
  #handleNames(params) {
    const target = params[0];
    if(target && target.startsWith('#')) {
      this.#server.handleNames(target);
    } else {
      this.#sendNep('NAMES');
    }
  }

  #handleNotice(params) {
    const target = params[0];
    const message = this.#parseMessage(params.slice(1));
    if(target && message) {
      if (target.startsWith('#')) {
        this.#server.handleNoticeToChannel(target, message);
      } else {
        this.#server.handleNoticeToNick(this, target, message);
      }
    }
    else
      this.#sendNep('NOTICE');
  }
  #handleWhois(params) {
    const target = params[0];
    if(target)
      this.#server.handleWhois(target);
    else
      this.#sendNep('WHOIS');
  }

  #handleQuit(params) {
    const message = this.#parseMessage(params.slice(0));
    this.#server.handleQuit(message)
  }
  #parseMessage(params) {
    let message = params.join(' ').substring(0);
    if(message.substr(0,1)===":")
      return message.substr(1);
    return message;
  }
    
  sendMessage(message) {
    this.#socket.write(message + '\n');
  }
  #sendNep(cmd) {
    this.sendMessage(`:* 461 * ${cmd} :Not enough parameters.`);
  }

  #getFormattedStartTime() {
    const startTimeNanoseconds = process.hrtime.bigint();
    const startTimeMilliseconds = Number(startTimeNanoseconds) / 1e6;
    const startDate = new Date(startTimeMilliseconds);
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const formattedTime = startDate.toLocaleTimeString([], { hour12: false });
    const formattedDate = `${months[startDate.getMonth()]} ${startDate.getDate()} ${startDate.getFullYear()}`;
    const formattedStartTime = `${formattedTime} ${formattedDate}`;

    return formattedStartTime;
  }
}
module.exports = Client;

