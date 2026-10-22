const { config, delegateHandlers } = require("../config");
const coreHandlers = require("@pagehub/mcp-core/handlers/remote");

// Delegate to mcp-core, then remember the active site in this process (each call runs in a fresh context).
const delegated = delegateHandlers(coreHandlers);

/** The site id a site-creating tool's reply names ("New site <id> created", "Active site set to <id>"). */
const idFromReply = result => result?.content?.[0]?.text?.match(/\b(?:Site|site|to)\s+([a-z0-9]{8,})\b/)?.[1];

module.exports = {
  async select_site(args) {
    const result = await delegated.select_site(args);
    config.activeSite = { id: args.id };
    return result;
  },

  async create_site(args) {
    const result = await delegated.create_site(args);
    const id = idFromReply(result);
    if (id) config.activeSite = { id };
    return result;
  },

  async duplicate_site(args) {
    const result = await delegated.duplicate_site(args);
    const id = idFromReply(result);
    if (id) config.activeSite = { id };
    return result;
  },

  async delete_site(args) {
    const result = await delegated.delete_site(args);
    if (config.activeSite?.id === args.id) config.activeSite = null;
    return result;
  },
};
