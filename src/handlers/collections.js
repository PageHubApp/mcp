// Delegated to mcp-core — collections CRUD is HTTP-only
const { delegateHandlers } = require("../config");
const coreCollections = require("@pagehub/mcp-core/handlers/remote-collections");

module.exports = delegateHandlers(coreCollections);
