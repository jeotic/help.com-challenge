const { createConnection } = require('net');
const { EOL } = require('os');

const ESCAPED_EOL = EOL.replace('\\', '\\\\');

class Client {
  constructor(opts) {
    this.lastHeartBeat = new Date();
    this.opts = opts;
    this.events = [];
    this.isAuthenticated = false;
    this.logger = opts.logger;
    this.lastRequestId = 0;
    this.pendingRequests = [];
  }

  log(msg) {
    if (this.logger) {
      this.logger(msg);
    } else {
      console.log(msg);
    }
  }

  setCredentials(userName, password) {
    this.userName = userName;
    this.password = password;
  }

  connect() {
    this.isAuthenticated = false;

    // re-create connection. Re-using connection leads to issues
    this.connection = this.createConnection();
  }

  onConnection() {
    this.lastHeartBeat = new Date();
    this.authenticate().then(() => {
      this.sendPendingRequests();
    });
  }

  reconnect() {
    if (!this.connection.connecting && this.connection.bufferSize === 0) {
      this.connection.end();
      this.connect();
    }
  }

  createConnection(opts = null) {
    // default to constructor opts
    if (opts === null) {
      opts = this.opts;
    }

    const { host, port } = opts;

    const connection = createConnection(
      {
        host,
        port
      },
      () => this.onConnection()
    );

    connection.on('data', data => {
      data = data.toString();
      if (/type['|"]:\s*['|"]heartbeat['|"]/i.test(data)) {
        this.tickHeart();
      } else if (this.authRequest) {
        this.processResponses(
          [this.authRequest],
          this.processResponseString(data)
        );
      } else {
        this.processResponses(
          this.pendingRequests,
          this.processResponseString(data)
        );
      }
    });

    connection.on('error', error => console.error(error));

    connection.on('close', () => {
      this.isAuthenticated = false;
      if (!connection.connecting) {
        this.connect();
      }
    });

    this.events.forEach(event => {
      if (!event.used) {
        connection.on(event.name, event.fn);
        event.used = true;
      }
    });

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.checkInterval = setInterval(() => {
      if (!connection.destroyed) {
        if (this.checkHeartbeat()) {
          this.sendPendingRequests();
        }
      }
    }, opts.reconnectTimeout || 2000);

    return connection;
  }

  // keep track of custom events, as connection is auto-created
  on(name, fn) {
    const event = {
      name,
      fn,
      used: false
    };

    if (this.connection) {
      this.connection.on(name, fn);
      event.used = true;
    }

    this.events.push(event);
  }

  write(message, raw = false) {
    const requests = this.createRequests(message);
    if (!raw) {
      this.pendingRequests = [...this.pendingRequests, ...requests];
    } else {
      // raw requests don't expect a response
      return Promise.resolve();
    }

    this.sendPendingRequests();

    return Promise.all(this.pendingRequests.map(r => r.promise));
  }

  sendPendingRequests() {
    return this.sendRequests(this.pendingRequests);
  }

  createRequest(message) {
    if (!message.id) {
      message.id = this.newRequestId();
    }

    const request = { id: message.id, message };

    request.promise = new Promise((resolve, reject) => {
      request.resolve = resolve;
      request.reject = reject;
    });

    return request;
  }

  createRequests(messages) {
    if (typeof messages === 'string') {
      try {
        return this.createRequests(JSON.parse(messages));
      } catch (e) {
        // log error?
        this.log('Invalid Message ' + messages);
        return [];
      }
    } else if (!(messages instanceof Array)) {
      return [this.createRequest(messages)];
    }

    return messages.map(m => this.createRequest(m));
  }

  createMessageString(message) {
    if (typeof message === 'string') {
      try {
        return this.createMessageString(JSON.parse(message));
      } catch (e) {
        // log error?
        this.log('Invalid Message ' + message);
      }
    } else if (message instanceof Array) {
      let msg = '';

      message.forEach(message => {
        msg = `${msg}${this.createMessageString(message)}`;
      });

      return msg;
    }

    return JSON.stringify(message) + EOL;
  }

  authenticate() {
    const { userName } = this;
    const authPayload = { name: userName };
    const request = this.createRequest(authPayload);

    this.authRequest = request;

    this.sendRequest(request);

    return request.promise.then(response => {
      if (response.type === 'welcome') {
        this.isAuthenticated = true;
      }

      this.authRequest = null;
    });
  }

  close() {
    this.closing = true;
    this.connection.close();
  }

  tickHeart() {
    this.lastHeartBeat = new Date();
  }

  checkHeartbeat() {
    const now = new Date();
    const ms = now.getTime() - this.lastHeartBeat.getTime();

    if (ms >= this.opts.reconnectTimeout && !this.connection.connecting) {
      this.log('Lost Connection: Reconnecting');
      this.reconnect();
      return false;
    }

    return true;
  }

  newRequestId() {
    const id = this.lastRequestId + 1;

    this.lastRequestId = id;

    return id;
  }

  sendPendingRequests() {
    if (this.pendingRequests.length > 0) {
      this.sendRequests(this.pendingRequests);
    }
  }

  sendRequest(request) {
    return this.sendRequests([request]);
  }

  sendRequests(requests) {
    const messages = requests.map(request => request.message);
    const msg = this.createMessageString(messages);

    if (
      this.connection &&
      !this.connection.destroyed &&
      !this.connection.connecting
    ) {
      this.connection.write(msg);
    }
  }

  processResponseString(rawResponse) {
    let rawResponses = [rawResponse];

    if (rawResponse.indexOf(EOL) > -1) {
      rawResponses = rawResponse.split(EOL);
    }

    const responses = [];

    rawResponses.forEach(rp => {
      if (!rp || rp === '') {
        return;
      }

      rp = rp.trim();

      if (rp[0] !== '{' && rp[0] !== '[') {
        return;
      }

      try {
        responses.push(JSON.parse(rp));
      } catch (e) {
        this.log('Invalid Response from Server');
      }
    });

    return responses.map(response => {
      if (response.type === 'msg') {
        response = response.msg;
        response.id = response.reply;
      }
      return response;
    });
  }

  processResponses(requests, responses) {
    try {
      responses.forEach(response => {
        requests.forEach((request, i) => {
          if (request.id === response.id) {
            requests.splice(i, 1);
            request.resolve(response);
          }
        });
      });
    } catch (e) {
      // swallow error. possibly log?
    }
  }
}

module.exports = Client;
