/**
 * All MCP tool definitions — loaded from the shared mcp-core tools.json.
 * Single source of truth: packages/mcp-core/src/tools.json
 */
const allToolsList = require('@pagehub/mcp-core/src/tools.json');

function allTools() {
  return allToolsList;
}

module.exports = { allTools };
