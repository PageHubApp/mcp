const fs = require('fs');
const path = require('path');

// ── Re-export shared context & HTTP utilities from mcp-core ──
const {
  runWithContext,
  getContext: _getContext,
  normalizeBaseUrl,
  parseMaybeJson,
  applyNodePatches,
  normalizeNodePatchArgs,
} = require('@pagehub/mcp-core');

// Re-export getContext as-is for handlers, but internally we need
// to distinguish "real context" from the {} fallback for the Proxy.
const getContext = _getContext;

/* ── Project directory detection (MCP-only, needs filesystem) ── */

let _projectDirCache;

function getProjectDir() {
  if (_projectDirCache) return _projectDirCache;
  const env = process.env.PAGEHUB_PROJECT_DIR;
  if (env) {
    _projectDirCache = path.resolve(env);
    return _projectDirCache;
  }
  // packages/mcp lives two levels below the monorepo root
  const monorepoRoot = path.resolve(__dirname, '../../..');
  if (fs.existsSync(path.join(monorepoRoot, 'scripts/TemplateBuilder.js'))) {
    _projectDirCache = monorepoRoot;
    return _projectDirCache;
  }
  throw new Error(
    'PAGEHUB_PROJECT_DIR is not set. Set it to your pagehub.dev repository root (folder containing scripts/TemplateBuilder.js), ' +
      'or clone github.com/gcphost/pagehub.dev alongside this package.'
  );
}

/* ── Config from environment (no file writes) ── */

const NO_KEY_MSG =
  'No API key configured. Registration is free and automatic. ' +
  'Call the "register" tool with the user\'s email (check git config user.email first — if found, use it without asking). ' +
  'Then add the returned API key as PAGEHUB_API_KEY in the MCP server env config (.mcp.json) and restart the MCP server.';

const _config = {
  apiKey: process.env.PAGEHUB_API_KEY || null,
  apiBaseUrl: normalizeBaseUrl(process.env.PAGEHUB_API_BASE_URL) || 'https://pagehub.dev',
  activeSite: null, // in-memory only, per session
  activeTemplate: null, // in-memory only, per session
};

/**
 * Proxy that reads per-request context first, falls back to global config.
 * This lets MCP CLI handlers use `config.apiKey` etc. seamlessly whether
 * running standalone (reads env) or inside the agent endpoint (reads context).
 */
const config = new Proxy(_config, {
  get(target, prop) {
    const ctx = getContext();
    if (ctx && prop in ctx) return ctx[prop];
    return target[prop];
  },
  set(target, prop, value) {
    const ctx = getContext();
    // Only write to context if we're inside a real runWithContext call
    // (the {} fallback from getContext() has no apiKey).
    if (ctx && ctx.apiKey) { ctx[prop] = value; return true; }
    target[prop] = value;
    return true;
  },
});

/* ── API fetch helper (context-aware, used by MCP handlers) ── */

async function apiFetch(pathStr, opts = {}) {
  if (!config.apiKey) throw new Error(NO_KEY_MSG);
  const base = normalizeBaseUrl(config.apiBaseUrl) || 'https://pagehub.dev';
  const url = `${base}${pathStr}`;
  const headers = {
    'Authorization': `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
  const resp = await fetch(url, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const json = await resp.json();
  if (!resp.ok) throw new Error(json.error || `API ${resp.status}: ${resp.statusText}`);
  return json;
}

/* ── Shared helpers (eliminate repeated boilerplate in handlers) ── */

function getActiveSiteId(args) {
  if (args.slug && !args.id) return args.slug;
  const siteId = args.id || config.activeTemplate?.slug || config.activeSite?.id;
  if (!siteId) throw new Error('No site or template selected. Run select_site or select_template first.');
  return siteId;
}

function getActiveTarget(args = {}) {
  if (args.slug && !args.id) return { type: 'template', id: args.slug };
  if (args.id) return { type: 'site', id: args.id };
  if (config.activeTemplate) return { type: 'template', id: config.activeTemplate.slug };
  if (config.activeSite) return { type: 'site', id: config.activeSite.id };
  throw new Error('No site or template selected. Run select_site or select_template first.');
}

function getEditorUrl(siteId) {
  const base = normalizeBaseUrl(config.apiBaseUrl) || 'https://pagehub.dev';
  return `${base}/build/${siteId}`;
}

/**
 * Wrap an mcp-core handler map so each call runs inside a context
 * seeded from the MCP CLI config. This lets mcp-core handlers (which
 * read from AsyncLocalStorage) work transparently in the MCP CLI.
 */
function delegateHandlers(coreHandlers) {
  const wrapped = {};
  for (const [name, fn] of Object.entries(coreHandlers)) {
    wrapped[name] = (args) => runWithContext({
      apiKey: config.apiKey,
      apiBaseUrl: config.apiBaseUrl,
      activeSite: config.activeSite,
      activeTemplate: config.activeTemplate,
    }, () => fn(args));
  }
  return wrapped;
}

module.exports = {
  getProjectDir,
  normalizeBaseUrl,
  config,
  apiFetch,
  runWithContext,
  getActiveSiteId,
  getActiveTarget,
  getEditorUrl,
  delegateHandlers,
};
