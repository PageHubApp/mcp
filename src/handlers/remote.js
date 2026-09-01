const { config, delegateHandlers } = require("../config");
const coreHandlers = require("@pagehub/mcp-core/handlers/remote");

// Delegate most handlers to mcp-core
const delegated = delegateHandlers(coreHandlers);

module.exports = {
  // ── MCP overrides: delegate then persist active target in memory ──

  async select_site(args) {
    const result = await delegated.select_site(args);
    config.activeTemplate = null;
    return result;
  },

  async select_template(args) {
    const result = await delegated.select_template(args);
    // Persist activeTemplate to outer config so it survives across tool calls
    config.activeTemplate = { slug: args.slug, title: result.content?.[0]?.text || "" };
    config.activeSite = null;
    return result;
  },

  async delete_site(args) {
    const result = await delegated.delete_site(args);
    if (config.activeSite?.id === args.id) {
      config.activeSite = null;
    }
    return result;
  },

  async delete_template(args) {
    const result = await delegated.delete_template(args);
    if (config.activeTemplate?.slug === args.slug) {
      config.activeTemplate = null;
    }
    return result;
  },

  // ── Pure delegation ──

  async create_site(args) {
    const result = await delegated.create_site(args);
    config.activeTemplate = null;
    return result;
  },

  async duplicate_site(args) {
    const result = await delegated.duplicate_site(args);
    config.activeTemplate = null;
    return result;
  },

  list_templates: delegated.list_templates,
  pull_template: delegated.pull_template,
  save_template: delegated.save_template,
  publish_site_as_template: delegated.publish_site_as_template,
  update_template: delegated.update_template,
  list_sites: delegated.list_sites,
  publish_site: delegated.publish_site,
  unpublish_site: delegated.unpublish_site,
  pull_site: delegated.pull_site,
  // upload_image / upload_file live in ./media — they add local `filePath`
  // support, which mcp-core can't have (it also backs the hosted agent).
  set_theme: delegated.set_theme,
  patch_site_node: delegated.patch_site_node,
  patch_site_bulk: delegated.patch_site_bulk,
  add_nodes: delegated.add_nodes,
  suggest_palettes: delegated.suggest_palettes,
  suggest_font_pairings: delegated.suggest_font_pairings,
};
