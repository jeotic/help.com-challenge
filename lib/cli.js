const { createInterface } = require('readline');
const { Writable } = require('stream');
const { EOL } = require('os');
const Client = require('./client');

class CLI {
  constructor(opts) {
    this.muted = false;
    this.repl = false;
    this.output = this.createOutput();

    this.interface = this.createInterface({
      input: process.stdin,
      output: this.output,
      terminal: true
    });

    this.client = this.createClient(opts);
  }

  log(msg) {
    console.log(EOL + msg);
    this.interface.prompt(true);
  }

  createClient(opts = {}) {
    opts.logger = msg => this.log(msg);
    return new Client(opts);
  }

  printPrettyResponse(response) {
    if (response.type === 'heartbeat') {
      return;
    }

    let prettyResponse = '';

    Object.keys(response).forEach(key => {
      if (key === 'id') {
        return;
      }
      const value = response[key];
      prettyResponse = `${prettyResponse}${key}: ${value}${EOL}`;
    });

    this.log(prettyResponse);
  }

  createOutput(writer = process.stdout) {
    return new Writable({
      write: (chunk, encoding, callback) => {
        if (this.muted) {
          writer.write('*', 'utf-8');
        } else {
          writer.write(chunk, encoding);
        }

        callback();
      }
    });
  }

  createInterface(opts) {
    const face = createInterface(opts);

    face.on('line', input => {
      if (this.repl) {
        this.readInput(input);
      }
    });

    return face;
  }

  async run() {
    await this.askForCredentials();
    this.client.connect();
    this.prompt();
  }

  askUsername() {
    return new Promise((resolve, reject) => {
      this.interface.question('Username: ', answer => {
        return resolve(answer);
      });
    });
  }

  askPassword() {
    return new Promise((resolve, reject) => {
      this.interface.question('Password: ', answer => {
        this.muted = false;
        return resolve(answer);
      });

      this.muted = true;
    });
  }

  async askForCredentials() {
    this.userName = await this.askUsername();
    this.password = await this.askPassword();

    this.client.setCredentials(this.userName, this.password);
  }

  prompt() {
    this.interface.prompt();
    this.repl = true;
  }

  readInput(input) {
    input = input.trim();
    let i = input.indexOf(' ');
    let params;

    if (i === -1) {
      i = input.length;
    } else {
      params = input.substring(i, input.length).trim();
    }

    const cmd = input.substring(1, i);

    this.runCommand(cmd, params);
  }

  async runCommand(cmd, params) {
    this.interface.pause();

    // possibly add loading message for slow responses?
    return (() => {
      switch (cmd) {
        case 'send':
          return this.runSend(params);
        case 'count':
          return this.runCount();
        case 'time':
          return this.runTime();
        case 'count&time':
        case 'time&count':
          return this.runCountTime();
        case 'test_invalid':
          return this.runTestInvalid();
        default:
          console.error('Invalid Command');
          this.prompt();
          return Promise.reject();
      }
    })()
      .then(() => {
        this.prompt();
      })
      .catch(error => {
        if (error) {
          this.log(error);
        }
      });
  }

  runSend(params) {
    if (params) {
      return this.client.write(params, true);
    }

    return Promise.reject('Invalid Params');
  }

  runCount() {
    return this.client
      .write({
        request: 'count'
      })
      .then(responses => this.handleCountResponse(responses[0]));
  }

  runTime() {
    return this.client
      .write({
        request: 'time'
      })
      .then(responses => this.handleTimeResponse(responses[0]));
  }

  runCountTime() {
    return this.client
      .write([
        {
          request: 'time'
        },
        {
          request: 'count'
        }
      ])
      .then(responses => {
        this.handleTimeResponse(responses[0]);
        this.handleCountResponse(responses[1]);
      });
  }

  handleTimeResponse(time) {
    // if time is greater than 30, show it
    this.printPrettyResponse(time);
    if (time.random > 30) {
      this.log('Time is greater than 30');
    }
  }

  handleCountResponse(count) {
    this.printPrettyResponse(count);
  }

  runTestInvalid() {
    return this.client.write('{\'test"}');
  }
}

module.exports = CLI;
