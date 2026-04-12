const { delegateHandlers } = require("../config");
const coreHandlers = require("@pagehub/mcp-core/src/handlers/pages");

module.exports = delegateHandlers(coreHandlers);
