const { delegateHandlers } = require('../config');
const coreHandlers = require('@pagehub/mcp-core/src/handlers/components');

module.exports = delegateHandlers(coreHandlers);
