const { expect } = require("chai");
const sinon = require("sinon");
const CLI = require("../lib/cli");

describe("CLI", function() {
  afterEach(function() {
    sinon.restore();
  });

  describe("Constructor", function() {
    it("should default muted to false", function() {
      const cli = new CLI();

      expect(cli.muted).to.be.false;
    });

    it("should default repl mode to false", function() {
      const cli = new CLI();

      expect(cli.repl).to.be.false;
    });

    it("should instantiate new output", function() {
      sinon.spy(CLI.prototype, "createOutput");

      const cli = new CLI();

      expect(cli.createOutput.calledOnce).to.be.true;
    });

    it("should instantiate new interface", function() {
      sinon.spy(CLI.prototype, "createInterface");

      const cli = new CLI();

      expect(cli.createInterface.calledOnce).to.be.true;
    });
  });

  describe("Output", function() {
    it("should replace text with astericks when muted", function(done) {
      const cli = new CLI();

      const writer = {
        write: function(input) {
          expect(input.toString()).to.equal("*");
          done();
        }
      };

      cli.output = cli.createOutput(writer);

      cli.interface = cli.createInterface({
        input: process.stdin,
        output: cli.output,
        terminal: true
      });

      cli.muted = true;

      cli.interface.write("t");
      cli.interface.close();
    });

    it("should not replace text with astericks when unmuted", function(done) {
      const cli = new CLI();

      const writer = {
        write: function(input) {
          expect(input.toString()).to.equal("t");
          done();
        }
      };

      cli.output = cli.createOutput(writer);

      cli.interface = cli.createInterface({
        input: process.stdin,
        output: cli.output,
        terminal: true
      });

      cli.interface.write("t");
      cli.interface.close();
    });
  });

  describe("Running Commands", function() {
    describe("/send", function() {
      it("should run runSend without params", function() {
        sinon.spy(CLI.prototype, "runSend");

        const cli = new CLI();

        cli.readInput("/send");
        cli.interface.close();
        expect(cli.runSend.calledOnce).to.be.true;
        expect(cli.runSend.getCall(0).args[1]).to.be.undefined;
      });

      it("should run runSend with params", function() {
        sinon.spy(CLI.prototype, "runSend");

        const cli = new CLI();
        const params = '{"test":"test"}';

        cli.readInput(`/send ${params}`);
        cli.interface.close();
        expect(cli.runSend.calledOnce).to.be.true;
        expect(cli.runSend.getCall(0).args[0]).to.equal(params);
      });
    });

    describe("/count", function() {
      it("should run runCount", function() {
        sinon.spy(CLI.prototype, "runCount");

        const cli = new CLI();

        cli.readInput("/count");
        cli.interface.close();
        expect(cli.runCount.calledOnce).to.be.true;
      });
    });

    describe("/time", function() {
      it("should run runTime", function() {
        sinon.spy(CLI.prototype, "runTime");

        const cli = new CLI();

        cli.readInput("/time");
        cli.interface.close();
        expect(cli.runTime.calledOnce).to.be.true;
      });
    });
  });
});
