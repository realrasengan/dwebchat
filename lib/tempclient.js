class TempClient {
  #socket;
  #onAuthenticated;
  #buffer = '';
  #nick = null;
  #user = null;
  #realName = null;
  #onDataBound;
  #capNegotiationStarted = false;
  #capNegotiation = false;
  #requestedCaps = [];
  #requiredCaps = ['self-message', 'echo-message', 'znc.in/echo-message'];
  #supportedCapsFound = false;
  #authenticationTimeout = null;
  #authenticationTimeoutDuration = 10000;

  constructor(socket, onAuthenticated) {
    this.#socket = socket;
    this.#onAuthenticated = onAuthenticated;

    this.#onDataBound = this.#onData.bind(this);
    this.#socket.on('data', this.#onDataBound);
    this.#startAuthenticationTimeout();
  }

  #onData(data) {
    this.#buffer += data.toString();
    let newlineIndex;
    while ((newlineIndex = this.#buffer.indexOf('\n')) !== -1) {
      const line = this.#buffer.substring(0, newlineIndex).trim();
      this.#buffer = this.#buffer.substring(newlineIndex + 1);
      this.#processLine(line);
    }
  }

  #processLine(line) {
    const [command, ...params] = line.split(' ');
    switch (command.toUpperCase()) {
      case "USER":
        if (params.length >= 4) {
          this.#user = params[0];
          this.#realName = params.slice(3).join(' ').substring(1);
          this.#tryAuthenticate();
        }
        else
          this.#socket.write(`:dwebchat 461 * USER :Not enough parameters.\r\n`);
        break;
      case "NICK":
        if (params.length > 0) {
          this.#nick = params[0];
          this.#tryAuthenticate();
        }
        else
          this.#socket.write(`:dwebchat 461 * NICK :Not enough parameters.\r\n`);
        break;
      case "CAP":
        if (params.length > 0) {
          this.#handleCap(params);
        }
        else
          this.#socket.write(`:dwebchat 461 * CAP :Not enough parameters.\r\n`);
        break;
      case "QUIT":
        this.#socket.end();
        break;
    }
  }

  #handleCap(params) {
    const subCommand = params[0] ? params[0].toUpperCase() : "";
    switch (subCommand) {
      case "LS":
        this.#capNegotiationStarted = true;
        this.#capNegotiation = true;
        clearTimeout(this.#authenticationTimeout);
        this.#socket.write(`CAP * LS :${this.#requiredCaps.join(' ')}\r\n`);
        break;
      case "REQ":
        if (params.length > 1) {
          const requested = params.slice(1).join(' ').split(' ');
          requested.forEach(cap => {
            if (this.#requiredCaps.includes(cap)) {
              this.#supportedCapsFound = true;
              this.#socket.write(`CAP * ACK :${cap}\r\n`);
            }
          });
        }
        break;
      case "END":
        this.#capNegotiation = false;
        this.#tryAuthenticate();
        break;
    }
  }

  #tryAuthenticate() {
    if (this.#nick && this.#user && (!this.#capNegotiationStarted || !this.#capNegotiation)) {
      this.#onAuthenticated(this.#nick, this.#user, this.#realName, this);
      this.#stopListening();
    } else if (this.#nick && this.#user) {
      this.#startAuthenticationTimeout();
    }
  }

  #startAuthenticationTimeout() {
    clearTimeout(this.#authenticationTimeout);
    this.#authenticationTimeout = setTimeout(() => {
      if (!this.#supportedCapsFound) {
        this.#socket.write("ERROR :Capability negotiation failed or required capabilities not provided.\r\n");
        this.#socket.end();
      }
    }, this.#authenticationTimeoutDuration);
  }

  #stopListening() {
    this.#socket.removeListener('data', this.#onDataBound);
    clearTimeout(this.#authenticationTimeout);
  }
}

module.exports = TempClient;
