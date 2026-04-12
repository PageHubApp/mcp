const { delegateHandlers } = require("../config");
const coreHandlers = require("@pagehub/mcp-core/src/handlers/kit");

module.exports = delegateHandlers(coreHandlers);
