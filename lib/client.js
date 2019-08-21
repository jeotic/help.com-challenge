const { createConnection } = require('net');

class Client {
  constructor(opts) {
    this.lastHeartBeat = new Date();
    this.opts = opts;
    this.events = [];
    this.queue = [];
    this.isAuthenticated = false;
    this.sendQueueInterval = null;
    this.logger = opts.logger;
    this.lastRequestId = 0;
  }

  log(msg) {
    if (this.logger) {
      this.logger(msg);
    } else {
      console.log(msg);
    }
  }

  connect() {
    const { host, port } = this.opts;

    this.isAuthenticated = false;

    if (this.connection) {
      this.connection.connect({
        host,
        port
      });
    } else {
      this.createConnection();
    }
  }

  reconnect() {
    if (this.connection.connecting) {
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

    if (!this.connection) {
      this.connection = createConnection({
        host,
        port
      });

      this.connection.on('data', data => {
        if (/type['|"]:\s*['|"]heartbeat['|"]/i.test(data.toString())) {
          this.tickHeart();
        }
      });

      this.connection.on('error', error => console.error(error));

      this.connection.on('connect', () => {
        this.lastHeartBeat = new Date();
        this.authenticate();
        this.sendQueue();
      });

      this.connection.on('close', () => {
        this.isAuthenticated = false;
        if (!this.connection.connecting) {
          this.connect();
        }
      });

      this.events.forEach(event => {
        if (!event.used) {
          this.connection.on(event.name, event.fn);
          event.used = true;
        }
      });

      setInterval(() => {
        if (!this.connection.destroyed) {
          this.checkHeartbeat();
        }
      }, opts.reconnectTimeout || 2000);
    }
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

  write(message) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        message,
        resolve,
        reject
      });
      this.sendQueue();
    });
  }

  createMessage(messages) {
    let msg = '';

    if (messages instanceof Array) {
      messages.forEach(message => {
        if (typeof message === 'string') {
          msg = `${msg}${message}`;
        } else {
          msg = `${msg}${JSON.stringify(message)}`;
        }
      });
    } else {
      msg = JSON.stringify(messages);
    }

    return msg;
  }

  sendQueue() {
    if (this.queue.length > 0 && this.isAuthenticated) {
      this.sendRequest(this.queue);
      this.queue = [];

      if (this.sendQueueInterval) {
        clearInterval(this.sendQueueInterval);
        this.sendQueueInterval = null;
      }
    } else {
      if (!this.sendQueueInterval) {
        this.sendQueueInterval = setInterval(() => {
          this.sendQueueInterval = null;
          this.sendQueue();
        }, 2000);
      }
    }
  }

  authenticate() {
    const { userName, password } = this;
    const authPayload = { name: userName, password };
    this.connection.write(JSON.stringify(authPayload));
    this.isAuthenticated = true;
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
    }
  }

  newRequestId() {
    const id = this.lastRequestId + 1;
    
    this.lastRequestId = id;

    return id;
  }

  sendRequest(requests) {
    if (!(requests instanceof Array)) {
      requests = [requests];
    }

    requests.forEach(request => {
      if (typeof request.message === 'string') {
        try {
          request.message = JSON.parse(requests);
        } catch (e) {
          request.reject('ERROR: Invalid Request Message');
          return;
        }
      }
      request.message.id = this.newRequestId();
    });

    const messages = requests.map(request => request.message);

    this.connection.write(this.createMessage(messages));

    this.connection.once('data', data => {
      try {
        responses = JSON.parse(data);

        if (!(responses instanceof Array)) {
          responses = [responses];
        }

        responses.forEach(response => {
          requests.forEach(request => {
            if (request.id === response.id) {
              request.resolve(response);
            }
          });
        });
      } catch (e) {
        // swallow error. possibly log?
      }
    });
  }
}

module.exports = Client;
