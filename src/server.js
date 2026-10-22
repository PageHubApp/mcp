const { Server } = require("@modelcontextprotocol/server");
const { serveStdio } = require("@modelcontextprotocol/server/stdio");
const { getServerTools, isToolEnabled } = require("./tools");
const { SERVER_INSTRUCTIONS } = require("@pagehub/mcp-core");

// Handler modules — each exports { toolName: async (args) => result }
const { handlers: coreHandlers } = require("@pagehub/mcp-core");
const { delegateHandlers } = require("./config");
const accessibilityHandlers = require("./handlers/accessibility");
const remoteHandlers = require("./handlers/remote");
const mediaHandlers = require("./handlers/media");
const importHandlers = require("./handlers/import");

const baseHandlers = {
  ...accessibilityHandlers,
  // Every mcp-core tool, run inside a context seeded from the CLI config.
  ...delegateHandlers(coreHandlers),
  // Keep the selected site across calls (each call gets a fresh context).
  ...remoteHandlers,
  // Overrides upload_image with the filePath-aware version and registers upload_file, set_download and
  // set_favicon with local-file support.
  ...mediaHandlers,
  // import_site with a local filePath (zips a folder, uploads it itself);
  // other modes and get_import_status delegate to mcp-core.
  ...importHandlers,
};

const handlers = baseHandlers;

// `instructions` rides the discover/initialize response into the client's
// system prompt — the condensed half of AGENT.md, delivered without the user
// pasting anything.
function buildServer() {
  const server = new Server(
    { name: "pagehub", version: "0.1.0" },
    { capabilities: { tools: {}, resources: {} }, instructions: SERVER_INSTRUCTIONS }
  );

  server.setRequestHandler("tools/list", async () => ({
    tools: getServerTools(handlers),
  }));
  server.setRequestHandler("resources/list", async () => ({ resources: [] }));
  server.setRequestHandler("resources/templates/list", async () => ({
    resourceTemplates: [],
  }));

  server.setRequestHandler("tools/call", async request => {
    try {
      const name = request.params.name;
      const args = request.params.arguments || {};
      if (!isToolEnabled(name, handlers)) {
        throw new Error(`Tool "${name}" is not available in this server mode.`);
      }
      const handler = handlers[name];
      return await handler(args);
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: error.message }] };
    }
  });

  return server;
}

// serveStdio answers both protocol eras: the client's opening message
// (2026-07-28 `server/discover` or 2025 `initialize`) picks one for the
// connection.
async function run() {
  serveStdio(buildServer);
  console.error("PageHub MCP Server Connected (api-first mode).");
}

module.exports = { run };
