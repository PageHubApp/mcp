const { delegateHandlers } = require("../config");
const coreNodes = require("@pagehub/mcp-core/src/handlers/nodes");
const coreSiteConfig = require("@pagehub/mcp-core/src/handlers/site-config");

// Node-level + site-config tools live in mcp-core. Re-export them through the
// MCP wrapper's context so the stdio server advertises them. (Regression fix:
// d47f60fd dropped local.js which held these delegations.)
const delegatedNodes = delegateHandlers(coreNodes);
const delegatedSiteConfig = delegateHandlers(coreSiteConfig);

module.exports = {
  delete_node: delegatedNodes.delete_node,
  insert_node: delegatedNodes.insert_node,
  move_node: delegatedNodes.move_node,
  list_site_nodes: delegatedNodes.list_site_nodes,
  search_site_nodes: delegatedNodes.search_site_nodes,
  set_integrations: delegatedSiteConfig.set_integrations,
  set_redirects: delegatedSiteConfig.set_redirects,
};
