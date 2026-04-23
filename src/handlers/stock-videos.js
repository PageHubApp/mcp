// Delegated to mcp-core — stock video tools are HTTP-only
const { delegateHandlers } = require("../config");
const coreStockVideos = require("@pagehub/mcp-core/src/handlers/stock-videos");

module.exports = delegateHandlers(coreStockVideos);
