const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { allTools } = require('./tools');

// Handler modules — each exports { toolName: async (args) => result }
const discoveryHandlers = require('./handlers/discovery');
const localHandlers = require('./handlers/local');
const sectionHandlers = require('./handlers/sections');
const remoteHandlers = require('./handlers/remote');
const accessibilityHandlers = require('./handlers/accessibility');
const portalHandlers = require('./handlers/portal');
const componentHandlers = require('./handlers/components');
const pageHandlers = require('./handlers/pages');
const aiHandlers = require('./handlers/ai');
const seoHandlers = require('./handlers/seo');

const handlers = {
  ...discoveryHandlers,
  ...localHandlers,
  ...sectionHandlers,
  ...remoteHandlers,
  ...portalHandlers,
  ...accessibilityHandlers,
  ...componentHandlers,
  ...pageHandlers,
  ...aiHandlers,
  ...seoHandlers,
};

const server = new Server(
  { name: 'pagehub', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allTools(),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const name = request.params.name;
    const args = request.params.arguments || {};
    const handler = handlers[name];
    if (!handler) throw new Error(`Unknown tool: ${name}`);
    return await handler(args);
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: error.message }] };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('PageHub MCP Template Server v2 Connected.');
}

module.exports = { server, run };
