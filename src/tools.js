/**
 * All MCP tool definitions — loaded from the shared mcp-core tools.json.
 * Single source of truth: packages/mcp-core/src/tools.json
 */
const allToolsList = require("@pagehub/mcp-core/src/tools.json");
const { AGENT_ALLOWED } = require("@pagehub/mcp-core");

function allTools() {
  return allToolsList;
}

function isToolEnabled(name, handlers) {
  if (!handlers || !handlers[name]) return false;
  return AGENT_ALLOWED.has(name);
}

function getServerTools(handlers) {
  return allToolsList.filter(tool => isToolEnabled(tool.name, handlers));
}

module.exports = { allTools, getServerTools, isToolEnabled };
