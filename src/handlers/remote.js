const { normalizeBaseUrl, config, delegateHandlers } = require('../config');
const coreHandlers = require('@pagehub/mcp-core/src/handlers/remote');

// Delegate most handlers to mcp-core
const delegated = delegateHandlers(coreHandlers);

module.exports = {
  // ── Stateless registration: returns key, AI client persists it ──

  async register(args) {
    const envBase = normalizeBaseUrl(process.env.PAGEHUB_API_BASE_URL);
    const baseUrl = envBase || normalizeBaseUrl(config.apiBaseUrl) || 'https://pagehub.dev';
    const url = `${baseUrl}/api/v1/register`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: args.email, name: args.name }),
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error(`Register endpoint returned non-JSON. URL: ${url} (status ${resp.status}). Is PAGEHUB_API_BASE_URL set? Current: ${config.apiBaseUrl}`); }
    if (!resp.ok) throw new Error(data.error || `Registration failed: ${resp.status}`);
    return {
      content: [{
        type: 'text',
        text: [
          `Registration successful!`,
          `  Email: ${data.email}`,
          `  Name: ${data.name}`,
          `  API Key: ${data.apiKey}`,
          ``,
          `To complete setup, add the API key to the MCP server config as an environment variable:`,
          `  "env": { "PAGEHUB_API_KEY": "${data.apiKey}" }`,
          ``,
          `Then restart the MCP server.`,
        ].join('\n'),
      }],
    };
  },

  // ── MCP overrides: delegate then persist active target in memory ──

  async select_site(args) {
    const result = await delegated.select_site(args);
    config.activeTemplate = null;
    return result;
  },

  async select_template(args) {
    const result = await delegated.select_template(args);
    // Persist activeTemplate to outer config so it survives across tool calls
    config.activeTemplate = { slug: args.slug, title: result.content?.[0]?.text || '' };
    config.activeSite = null;
    return result;
  },

  async save_site(args) {
    const result = await delegated.save_site(args);
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

  list_templates: delegated.list_templates,
  pull_template: delegated.pull_template,
  save_template: delegated.save_template,
  publish_site_as_template: delegated.publish_site_as_template,
  update_template: delegated.update_template,
  list_sites: delegated.list_sites,
  pull_site: delegated.pull_site,
  upload_image: delegated.upload_image,
  patch_site_node: delegated.patch_site_node,
  patch_site_bulk: delegated.patch_site_bulk,
  add_nodes: delegated.add_nodes,
  suggest_palettes: delegated.suggest_palettes,
};
