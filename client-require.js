const fs = require("fs");
const path = require("path");
const clientPath = path.join(__dirname, "client-require.txt");
const clientCode = fs.readFileSync(clientPath, "utf8");

module.exports = eval(clientCode);