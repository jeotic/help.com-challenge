const CLI = require("./lib/cli");

const cli = new CLI({
    host: '35.226.214.55',
    port: 9432,
    reconnectTimeout: 2000
});

cli.run();
