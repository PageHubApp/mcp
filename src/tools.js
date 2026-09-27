/**
 * All MCP tool definitions — loaded from mcp-core's resolved tool list.
 * Single source of truth: packages/mcp-core/src/tools.json (raw schemas) +
 * packages/mcp-core/src/vibes.js (vibe enum, substituted into "$VIBES" sentinels
 * by mcp-core's getAllTools()).
 */
const { getAllTools, AGENT_ALLOWED } = require("@pagehub/mcp-core");
const allToolsList = getAllTools();

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
