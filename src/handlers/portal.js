const { delegateHandlers } = require("../config");
const coreHandlers = require("@pagehub/mcp-core/handlers/portal");

module.exports = delegateHandlers(coreHandlers);
