// Delegated to mcp-core — SEO audit is HTTP-only
const { delegateHandlers } = require("../config");
const coreSeo = require("@pagehub/mcp-core/src/handlers/seo");

module.exports = delegateHandlers(coreSeo);
