// Delegated to mcp-core — stock image tools are HTTP-only
const { delegateHandlers } = require("../config");
const coreStockImages = require("@pagehub/mcp-core/handlers/stock-images");

module.exports = delegateHandlers(coreStockImages);
