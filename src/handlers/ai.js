// Delegated to mcp-core — AI tools are HTTP-only
const { delegateHandlers } = require('../config');
const coreAi = require('@pagehub/mcp-core/src/handlers/ai');

module.exports = delegateHandlers(coreAi);
