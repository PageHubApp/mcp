const { delegateHandlers } = require('../config');
const coreHandlers = require('@pagehub/mcp-core/src/handlers/portal');

module.exports = delegateHandlers(coreHandlers);
