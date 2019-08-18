const { createInterface } = require("readline");
const { Writable } = require("stream");
const Client = require("./client");

class CLI {
  constructor() {
    this.muted = false;
    this.repl = false;
    this.output = this.createOutput();

    this.interface = this.createInterface({
      input: process.stdin,
      output: this.output,
      terminal: true
    });

    this.client = this.createClient();
  }

  createClient() {
    const client = new Client();

    client.connection.on("data", data => {
      const strData = data.toString();
      const json = JSON.parse(strData);

      console.log(json);
    });
  }

  createOutput(writer = process.stdout) {
    return new Writable({
      write: (chunk, encoding, callback) => {
        if (this.muted) {
          writer.write("*", "utf-8");
        } else {
          writer.write(chunk, encoding);
        }

        callback();
      }
    });
  }

  createInterface(opts) {
    const face = createInterface(opts);

    face.on("line", input => {
      if (this.repl) {
        this.readInput(input);
      }
    });

    return face;
  }

  async run() {
    await this.askForCredentials();
    this.prompt();
  }

  askUsername() {
    return new Promise((resolve, reject) => {
      this.interface.question("Username: ", answer => {
        return resolve(answer);
      });
    });
  }

  askPassword() {
    return new Promise((resolve, reject) => {
      this.interface.question("Password: ", answer => {
        this.muted = false;
        return resolve(answer);
      });

      this.muted = true;
    });
  }

  async askForCredentials() {
    this.userName = await this.askUsername();
    this.password = await this.askPassword();
  }

  prompt() {
    this.interface.prompt();
    this.repl = true;
  }

  readInput(input) {
    input = input.trim();
    let i = input.indexOf(" ");
    let params;

    if (i === -1) {
      i = input.length;
    } else {
      params = input.substring(i, input.length).trim();
    }

    const cmd = input.substring(1, i);

    this.runCommand(cmd, params);
  }

  runCommand(cmd, params) {
    switch (cmd) {
      case "send":
        this.runSend(params);
        break;
      case "count":
        this.runCount();
        break;
      case "time":
        this.runTime();
        break;
      default:
        console.error("Invalid Command");
        this.prompt();
    }
  }

  runSend(params) {}

  runCount() {}

  runTime() {}

  tickHeartbeat() {}
}

module.exports = CLI;
