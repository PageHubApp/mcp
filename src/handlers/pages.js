const { delegateHandlers } = require("../config");
const coreHandlers = require("@pagehub/mcp-core/handlers/pages");

module.exports = delegateHandlers(coreHandlers);
