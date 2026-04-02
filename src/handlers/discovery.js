// Delegated to mcp-core — all discovery tools are HTTP-only
const { delegateHandlers } = require('../config');
const coreDiscovery = require('@pagehub/mcp-core/src/handlers/discovery');

module.exports = delegateHandlers(coreDiscovery);
