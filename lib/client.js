const { createConnection } = require("net");

class Client {
  connect() {
    if (!this.connection) {
      this.connection = createConnection({
        host: "35.226.214.55",
        port: 9432
      });
    } else {
      this.connection.connect();
    }
  }

  close() {
    this.closing = true;
    this.connection.close();
  }
}

module.exports = Client;
