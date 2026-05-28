const { delegateHandlers } = require("../config");
const coreHandlers = require("@pagehub/mcp-core/handlers/components");

module.exports = delegateHandlers(coreHandlers);
