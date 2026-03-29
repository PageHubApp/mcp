#!/usr/bin/env node
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * PageHub app root: directory that contains scripts/TemplateBuilder.js.
 * - Set PAGEHUB_PROJECT_DIR when running the MCP from a standalone clone (github.com/PageHubJS/mcp).
 * - Inside the full pagehub.dev repo (packages/mcp or scripts/mcp-server shim), auto-detected via ../..
 */
let _projectDirCache;
function getProjectDir() {
  if (_projectDirCache) return _projectDirCache;
  const env = process.env.PAGEHUB_PROJECT_DIR;
  if (env) {
    _projectDirCache = path.resolve(env);
    return _projectDirCache;
  }
  const monorepoRoot = path.resolve(__dirname, '../..');
  if (fs.existsSync(path.join(monorepoRoot, 'scripts/TemplateBuilder.js'))) {
    _projectDirCache = monorepoRoot;
    return _projectDirCache;
  }
  throw new Error(
    'PAGEHUB_PROJECT_DIR is not set. Set it to your pagehub.dev repository root (folder containing scripts/TemplateBuilder.js), ' +
      'or clone github.com/gcphost/pagehub.dev alongside this package.'
  );
}

const TemplateBuilder = require(path.join(getProjectDir(), 'scripts/TemplateBuilder.js'));

function getDecodedExamplesDir() {
  return path.join(getProjectDir(), 'data/examples/decoded');
}

/* ────────────────────── helpers (local) ────────────────────── */

function runEncode() {
  execSync('node scripts/examples.js encode', { cwd: getProjectDir() });
}

function runSyncRegistry() {
  try {
    execSync('node scripts/sync-examples-registry.js', { cwd: getProjectDir(), stdio: 'ignore' });
  } catch {
    /* optional */
  }
}

function parseMaybeJson(v) {
  if (v == null) return v;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}

/* ────────────────────── config / API key ────────────────────── */

/** Strip trailing slash; empty -> null */
function normalizeBaseUrl(url) {
  if (url == null || url === '') return null;
  const s = String(url).trim().replace(/\/$/, '');
  return s || null;
}

/**
 * apiBaseUrl resolution (first match wins):
 * 1. .pagehub file apiBaseUrl (local dev override)
 * 2. PAGEHUB_API_BASE_URL env
 * 3. https://pagehub.dev
 */
function loadConfig() {
  let apiBaseUrl = 'https://pagehub.dev';
  const envBase = normalizeBaseUrl(process.env.PAGEHUB_API_BASE_URL);
  if (envBase) apiBaseUrl = envBase;

  const cfg = { apiKey: null, apiBaseUrl, activeSite: null };
  if (process.env.PAGEHUB_API_KEY) cfg.apiKey = process.env.PAGEHUB_API_KEY;
  try {
    const disk = JSON.parse(fs.readFileSync(path.join(getProjectDir(), '.pagehub'), 'utf8'));
    if (disk.apiKey && !cfg.apiKey) cfg.apiKey = disk.apiKey;
    const diskBase = normalizeBaseUrl(disk.apiBaseUrl);
    if (diskBase) cfg.apiBaseUrl = diskBase;
    if (disk.activeSite) cfg.activeSite = disk.activeSite;
  } catch { /* no config file yet */ }
  return cfg;
}

function saveConfig(cfg) {
  fs.writeFileSync(path.join(getProjectDir(), '.pagehub'), JSON.stringify(cfg, null, 2) + '\n', 'utf8');
}

let config = loadConfig();

/* ────────────────────── API fetch helper ────────────────────── */

async function apiFetch(pathStr, opts = {}) {
  if (!config.apiKey) throw new Error('No API key configured. Run the "configure" tool first.');
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

/* ────────────────────── Image URL validation ────────────────────── */

/**
 * Extract all image URLs from a node's props (content field for Image nodes,
 * backgroundImage for containers, icon URLs, etc.)
 */
function extractImageUrls(props, resolvedName) {
  const urls = [];
  if (!props) return urls;
  // Image component content
  if (resolvedName === 'Image' && props.content && typeof props.content === 'string') {
    if (props.type === 'url' || (!props.type && props.content.startsWith('http'))) {
      urls.push(props.content);
    }
  }
  // Background image on any container
  if (props.backgroundImage && typeof props.backgroundImage === 'string' && props.backgroundImage.startsWith('http')) {
    urls.push(props.backgroundImage);
  }
  return urls;
}

/**
 * Validate image URLs return HTTP 200. Returns array of { url, status } for failures.
 */
async function validateImageUrls(urls) {
  const failures = [];
  for (const url of urls) {
    try {
      const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
      if (!resp.ok) {
        failures.push({ url, status: resp.status });
      }
    } catch (e) {
      failures.push({ url, status: `error: ${e.message}` });
    }
  }
  return failures;
}

/**
 * Collect all image URLs from a flat node map (for bulk validation).
 */
function collectAllImageUrls(nodes) {
  const urls = [];
  for (const [id, node] of Object.entries(nodes)) {
    const resolved = node.type?.resolvedName;
    const found = extractImageUrls(node.props, resolved);
    for (const url of found) urls.push({ nodeId: id, url });
  }
  return urls;
}

/* ────────────────────── Mutex ────────────────────── */

class Mutex {
  constructor() {
    this.queue = [];
    this.locked = false;
  }
  async lock() {
    return new Promise(resolve => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }
  release() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next();
    } else {
      this.locked = false;
    }
  }
}
const fsMutex = new Mutex();

/** Mutates flat Craft map: merge patches then apply unsets. */
function applyNodePatches(flatMap, nodeId, patchArgs) {
  const {
    propsPatch,
    mobilePatch,
    rootPatch,
    nodesPatch,
    unsetProps,
    unsetMobile,
    unsetRoot,
  } = patchArgs;
  if (!flatMap[nodeId]) throw new Error(`Node ${nodeId} not found`);
  if (propsPatch) flatMap[nodeId].props = { ...flatMap[nodeId].props, ...propsPatch };
  if (mobilePatch) {
    flatMap[nodeId].props.mobile = { ...(flatMap[nodeId].props.mobile || {}), ...mobilePatch };
  }
  if (rootPatch) flatMap[nodeId].props.root = { ...(flatMap[nodeId].props.root || {}), ...rootPatch };
  if (nodesPatch) flatMap[nodeId].nodes = nodesPatch;
  if (Array.isArray(unsetProps)) {
    for (const k of unsetProps) delete flatMap[nodeId].props[k];
  }
  if (Array.isArray(unsetMobile)) {
    const m = flatMap[nodeId].props.mobile || {};
    for (const k of unsetMobile) delete m[k];
    flatMap[nodeId].props.mobile = m;
  }
  if (Array.isArray(unsetRoot)) {
    const r = flatMap[nodeId].props.root || {};
    for (const k of unsetRoot) delete r[k];
    flatMap[nodeId].props.root = r;
  }
}

/* ────────────────────── tool definitions (local) ────────────────────── */

const toolSetTheme = {
  name: 'set_theme',
  description:
    'Creates or updates the ROOT node theme for a template — palette colors, styleGuide (spacing, radius, shadows, fonts), Google Fonts, and JSON-LD structured data. If the decoded slug file does not exist yet, it auto-scaffolds from the acme base. Always call this FIRST when building a new template, before adding sections.\n\nWorkflow: create_template → set_theme → add_section (repeat) → set_nav → set_footer → encode_all_templates',
  inputSchema: {
    type: 'object',
    properties: {
      slug: { type: 'string', description: 'Template slug (filename without .json). Used as the URL path and file identifier.' },
      preset: { type: 'string', description: 'Optional preset ID from list_presets. Loads palette, fonts, and styleGuide from the preset as defaults. Individual palette/fonts/styleGuide params override preset values. Example: "warm-editorial", "modern-minimal", "luxury-dark".' },
      title: { type: 'string', description: 'Human-readable template title shown in the template gallery.' },
      description: { type: 'string', description: 'Short description (≤75 chars) for the template gallery card.' },
      image: { type: 'string', description: 'Preview image URL for the template gallery.' },
      demo: { type: 'string', description: 'Demo site URL.' },
      homePage: { type: 'boolean', description: 'Whether this template represents a home page (default true).' },
      hidden: { type: 'boolean', description: 'Hide from public template gallery.' },
      palette: {
        type: 'array',
        description: 'Array of exactly 12 color slots defining the design system. Each slot is {name, color}. Order matters — maps to CSS variables.\n\nSlots (in order):\n  0: Primary — main brand color (buttons, links, accents)\n  1: Primary Text — text on primary backgrounds\n  2: Secondary — supporting brand color (cards, badges)\n  3: Secondary Text — text on secondary backgrounds\n  4: Accent — call-to-action color (CTAs, highlights)\n  5: Accent Text — text on accent backgrounds\n  6: Neutral — muted/subtle color (borders, disabled states)\n  7: Neutral Text — text on neutral backgrounds\n  8: Background — page background color\n  9: Text — default body text color\n  10: Alternate Background — alternate section backgrounds, cards\n  11: Alternate Text — text on alternate backgrounds\n\nExample: [{"name":"Primary","color":"#2d4a3e"},{"name":"Primary Text","color":"#ffffff"}, ...]',
      },
      styleGuide: {
        type: 'object',
        description: 'Design tokens object. All values become CSS variables (--ph-*).\n\nCommon keys:\n  borderRadius: "0.5rem" — buttons, cards, inputs\n  buttonPadding: "0.75rem 1.5rem" — button padding (Y X)\n  containerPadding: "2rem 2rem" — section inner padding (Y X)\n  sectionGap: "4rem" — vertical space between sections\n  containerGap: "1.5rem" — gap between items in a section\n  contentWidth: "80rem" — max-width for content containers\n  headingFont: "font-bold" — Tailwind font-weight for headings\n  headingFontFamily: "Playfair Display" — Google Font name for headings\n  bodyFont: "font-normal" — Tailwind font-weight for body\n  bodyFontFamily: "Inter" — Google Font name for body text\n  shadowStyle: "0 1px 3px rgba(0,0,0,0.1)" — default box-shadow\n  inputBorderWidth: "1px"\n  inputBorderColor: "#e2e8f0"\n  inputBorderRadius: "0.375rem"\n  inputBgColor: "#ffffff"\n  inputPlaceholderColor: "#94a3b8"\n  inputFocusRingColor: "#3b82f6"\n  linkColor: "#2563eb"\n  linkHoverColor: "#1d4ed8"',
      },
      fonts: {
        type: 'object',
        description: 'Google Fonts configuration. Two formats supported:\n\n  Option A — full URL: { "url": "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;500;600&display=swap" }\n\n  Option B — family list: { "families": ["Playfair Display:wght@400;700", "Inter:wght@400;500;600"] }\n\nThe families are injected as a <link> tag in the page <head>.',
      },
      jsonLd: { type: 'object', description: 'Schema.org JSON-LD object injected as a <script type="application/ld+json"> tag. Use {{company.name}}, {{company.phone}}, etc. for dynamic values.' },
    },
    required: ['slug'],
  },
};

const toolAddSection = {
  name: 'add_section',
  description:
    'Appends a pre-built section template to the page. Use list_sections to see all available template IDs and their descriptions.\n\nOverrides let you customize content and styling without hand-crafting nodes. Keys in contentOverrides and propOverrides are matched by the node\'s custom.displayName (e.g. "Title", "Subtitle", "CTA Button", "Image").\n\nCall list_sections first to see available IDs and their displayName targets.',
  inputSchema: {
    type: 'object',
    properties: {
      slug: { type: 'string', description: 'Template slug to add the section to.' },
      templateId: {
        type: 'string',
        description: 'Section template ID. Use list_sections to see all available IDs. Examples: "hero-1", "hero-2", "header-1", "footer-1", "pricing-1", "services-1", "imagetext-1", "optin-1", "texts-1", "team-1".',
      },
      contentOverrides: {
        type: 'object',
        description: 'Map of displayName → content patch. Patches the node\'s top-level props (text, url, content, alt, icon, etc.).\n\nExamples:\n  {"Title": {"text": "Welcome to our store"}, "CTA Button": {"text": "Shop Now", "url": "/shop"}, "Image": {"content": "https://example.com/hero.jpg"}}\n\nFor Text nodes: set "text" (plain text or inline HTML with <strong>, <em>, <br/>, <span>).\nFor Button nodes: set "text", "url", "icon".\nFor Image nodes: set "content" (URL), "alt", "type" ("url" for external images).',
      },
      propOverrides: {
        type: 'object',
        description: 'Map of displayName → style patches. Each value can have { root, mobile, desktop } keys with Tailwind class objects.\n\nExample:\n  {"Section": {"root": {"background": "bg-[var(--ph-primary)]"}, "mobile": {"py": "py-20"}, "desktop": {"py": "py-32"}}}',
      },
      position: { type: 'number', description: 'Insert index in page_home.nodes. 0 = first section. Default: append to end.' },
    },
    required: ['slug', 'templateId'],
  },
};

const toolAddCustomSection = {
  name: 'add_custom_section',
  description: 'Merges a hand-crafted flat CraftJS node map into the template and attaches sectionRootId as a child of page_home (or parentNodeId). Use this when no pre-built section template fits your needs.\n\nUse get_component_schema to see all available component types and their props. Each node in the map must have: type.resolvedName, props (with root, mobile, desktop), parent, nodes[], and custom.displayName.\n\nThe sectionRootId node should have type "section" and canDelete: true.',
  inputSchema: {
    type: 'object',
    properties: {
      slug: { type: 'string', description: 'Template slug to merge into.' },
      sectionRootId: { type: 'string', description: 'Node ID of the section root in your nodes map. This gets attached to page_home. Use descriptive IDs like "sec_testimonials", "sec_gallery".' },
      nodes: {
        type: 'object',
        description: 'Flat CraftJS node map: { nodeId: nodeDefinition, ... }. Each node definition must include:\n\n  {\n    "type": { "resolvedName": "Container" },  // Component type\n    "isCanvas": true,                          // true if it can have children\n    "props": {\n      "canDelete": true,\n      "canEditName": true,\n      "type": "section",                       // "section" for root, omit for children\n      "root": { "background": "bg-[var(--ph-primary)]" },\n      "mobile": { "display": "flex", "flexDirection": "flex-col", "width": "w-full", "py": "py-12", "px": "px-6" },\n      "desktop": { "py": "py-20", "px": "px-16" },\n      "custom": { "displayName": "My Section" }\n    },\n    "parent": "page_home",                     // parent node ID\n    "nodes": ["child_id_1", "child_id_2"],     // ordered child IDs\n    "linkedNodes": {}\n  }\n\nAvailable component types: Container, Text, Image, Button, ButtonList, ImageList, Form, FormElement, Divider, Spacer, Video, Audio, Embed.\nUse get_component_schema for full prop details.',
      },
      parentNodeId: { type: 'string', description: 'Parent node to attach to. Default: "page_home".' },
      position: { type: 'number', description: 'Insert index in parent\'s nodes array. Default: append to end.' },
    },
    required: ['slug', 'sectionRootId', 'nodes'],
  },
};

const toolSetNav = {
  name: 'set_nav',
  description: 'Configures the header navigation — logo, nav links, colors, and mobile hamburger menu overlay. Replaces all existing nav buttons with the provided links array. The mobile menu is auto-generated with show/hide toggle behavior.',
  inputSchema: {
    type: 'object',
    properties: {
      slug: { type: 'string', description: 'Template slug.' },
      menuId: { type: 'string', description: 'Unique DOM id for the mobile menu overlay element. Use slug-based names like "bookstore-nav".' },
      menuTitle: { type: 'string', description: 'Text shown at top of mobile menu overlay (e.g. "Menu", "Navigation").' },
      logoText: { type: 'string', description: 'Brand/logo text in the header. Use {{company.name}} for dynamic company name.' },
      logoFont: { type: 'string', description: 'CSS font-family for the logo text (e.g. "Playfair Display", "Georgia").' },
      headerBg: { type: 'string', description: 'Tailwind background class for the header. Use palette vars: "bg-[var(--ph-background)]", "bg-[var(--ph-primary)]", "bg-transparent".' },
      headerColor: { type: 'string', description: 'Tailwind text color class for header text/links. Use: "text-[var(--ph-text)]", "text-[var(--ph-primary-text)]".' },
      links: {
        type: 'array',
        description: 'Navigation links array. Each link becomes a button in the desktop nav and a menu item in the mobile overlay.',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Link label (e.g. "About", "Shop", "Contact").' },
            url: { type: 'string', description: 'Link URL. Use "#section-id" for same-page anchors, "/path" for internal pages, or full URLs for external.' },
          },
          required: ['text', 'url'],
        },
      },
      phone: {
        type: 'object',
        description: 'Optional phone number link shown in the header (visible on both mobile and desktop).',
        properties: {
          text: { type: 'string', description: 'Display text (e.g. "(555) 123-4567").' },
          url: { type: 'string', description: 'Phone URL (e.g. "tel:+15551234567" or "tel:{{company.phone}}").' },
        },
      },
    },
    required: ['slug', 'menuId', 'menuTitle', 'links'],
  },
};

const toolSetFooter = {
  name: 'set_footer',
  description: 'Configures the footer section — background color, text color, and copyright/attribution text. Patches the ftr_content container and ftr_text text node.',
  inputSchema: {
    type: 'object',
    properties: {
      slug: { type: 'string', description: 'Template slug.' },
      contentBackground: { type: 'string', description: 'Tailwind background class for footer container. Example: "bg-[var(--ph-primary)]", "bg-[var(--ph-alternate-background)]".' },
      contentColor: { type: 'string', description: 'Tailwind text color class for footer. Example: "text-[var(--ph-primary-text)]".' },
      copyrightHtml: { type: 'string', description: 'Copyright line ONLY — a single short text like "© {{year}} {{company.name}}". Keep it simple.\n\nDO NOT cram address, phone, nav links, or multi-line content into this field. For rich footers with links, address, and multiple rows, use add_custom_section to build a proper footer structure with separate Text nodes and ButtonList for nav links.\n\nExample: "© {{year}} {{company.name}}. All rights reserved."' },
      copyrightTagName: { type: 'string', description: 'HTML tag for copyright text. Default: "p". Options: "p", "div", "span".' },
      copyrightRootColor: { type: 'string', description: 'Tailwind text color for copyright specifically (overrides contentColor for just this element).' },
    },
    required: ['slug'],
  },
};

/* ────────────────────── tool definitions (remote / API) ────────────────────── */

const toolConfigure = {
  name: 'configure',
  description: 'Set API key and optional base URL. Writes to .pagehub config. Required before any remote tool.',
  inputSchema: {
    type: 'object',
    properties: {
      apiKey: { type: 'string', description: 'ph_xxx tenant API key' },
      apiBaseUrl: {
        type: 'string',
        description:
          'Optional. Default production https://pagehub.dev. Override with .pagehub apiBaseUrl or PAGEHUB_API_BASE_URL (e.g. http://localhost:3000).',
      },
    },
    required: ['apiKey'],
  },
};

const toolRegister = {
  name: 'register',
  description: 'Register a new account with email. Returns an API key and auto-configures it.',
  inputSchema: {
    type: 'object',
    properties: {
      email: { type: 'string', description: 'Email address (required)' },
      name: { type: 'string', description: 'Display name (optional, derived from email if omitted)' },
    },
    required: ['email'],
  },
};

const toolListTemplates = {
  name: 'list_templates',
  description: 'List stock page templates from pagehub.dev catalog (remote, requires API key).',
  inputSchema: { type: 'object', properties: {} },
};

const toolPullTemplate = {
  name: 'pull_template',
  description: 'Download a stock template by slug from the API and save as local decoded JSON for editing.',
  inputSchema: {
    type: 'object',
    properties: {
      slug: { type: 'string', description: 'Template slug to pull' },
    },
    required: ['slug'],
  },
};

const toolListSites = {
  name: 'list_sites',
  description: 'List all sites belonging to the authenticated tenant (remote).',
  inputSchema: { type: 'object', properties: {} },
};

const toolSelectSite = {
  name: 'select_site',
  description: 'Set the active site context by id. Persisted to .pagehub config.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Page _id to set as active' },
    },
    required: ['id'],
  },
};

const toolPullSite = {
  name: 'pull_site',
  description:
    'Fetches site from API for verification. By default does NOT write the repo. Live sites: edit only via patch_site_node (incremental) or save_site with inline content — never edit data/examples/decoded for API sites. Pass writeLocal: true only when mirroring into the repo for example/template tooling.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Site id (defaults to active site if omitted)' },
      writeLocal: {
        type: 'boolean',
        description:
          'If true, writes data/examples/decoded/{slug}.json (repo examples only). Default false — API-first; use patch_site_node to edit.',
      },
    },
  },
};

const toolSaveSite = {
  name: 'save_site',
  description:
    'PUT full decoded node map to an existing site (active or id), or POST to create. For API-backed sites you MUST pass content (inline JSON). Prefer patch_site_node for small edits. slug loads from disk — only for committed stock examples in this repo, not for sites pulled from the API.',
  inputSchema: {
    type: 'object',
    properties: {
      slug: {
        type: 'string',
        description:
          'Repo-only: loads data/examples/decoded/{slug}.json. Do not use for live API sites; use content or patch_site_node.',
      },
      content: { type: 'object', description: 'Full flat Craft map — required path for updating remote sites without local files' },
      name: { type: 'string', description: 'Site name (for new sites or rename)' },
      title: { type: 'string' },
      description: { type: 'string' },
      id: { type: 'string', description: 'Explicit site id to update (overrides active site)' },
    },
  },
};

const toolDeleteSite = {
  name: 'delete_site',
  description: 'Delete a site by id from the API. Requires explicit id for safety.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Page _id to delete' },
    },
    required: ['id'],
  },
};

const toolUploadImage = {
  name: 'upload_image',
  description:
    'Upload an image to the tenant CDN for a site (requires Cloudflare Images on the server). Returns mediaId and url; use type "cdn" and content mediaId on Image/Background nodes. Prefer imageUrl for large files.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Site id (defaults to active site from select_site)' },
      imageUrl: { type: 'string', description: 'Public http(s) URL to fetch and upload' },
      dataBase64: {
        type: 'string',
        description: 'Raw base64 or data URL (data:image/...;base64,...). Max ~12MB decoded.',
      },
      mimeType: { type: 'string', description: 'With dataBase64, e.g. image/png (default image/jpeg)' },
      filename: { type: 'string', description: 'Optional filename hint when using dataBase64' },
    },
  },
};

const toolPatchSiteNode = {
  name: 'patch_site_node',
  description:
    'Edit one node on a live site (GET, patch, PUT). For multiple nodes use patch_site_bulk (atomic, no races). Same patch fields as update_node (propsPatch, mobilePatch, rootPatch, unset*). Example: nodeId page_home, unsetMobile ["py"] removes page wrapper vertical padding.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Site id (defaults to active site)' },
      nodeId: { type: 'string', description: 'Craft node id e.g. page_home, ROOT' },
      propsPatch: { type: 'object' },
      mobilePatch: { type: 'object' },
      rootPatch: { type: 'object' },
      nodesPatch: { type: 'array', items: { type: 'string' } },
      unsetProps: { type: 'array', items: { type: 'string' } },
      unsetMobile: { type: 'array', items: { type: 'string' } },
      unsetRoot: { type: 'array', items: { type: 'string' } },
      name: { type: 'string', description: 'Optional site rename on PUT' },
      title: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['nodeId'],
  },
};

const patchItemSchemaProps = {
  nodeId: { type: 'string', description: 'Craft node id e.g. page_home, ROOT' },
  propsPatch: { type: 'object' },
  mobilePatch: { type: 'object' },
  rootPatch: { type: 'object' },
  nodesPatch: { type: 'array', items: { type: 'string' } },
  unsetProps: { type: 'array', items: { type: 'string' } },
  unsetMobile: { type: 'array', items: { type: 'string' } },
  unsetRoot: { type: 'array', items: { type: 'string' } },
};

const toolPatchSiteBulk = {
  name: 'patch_site_bulk',
  description:
    'Same as patch_site_node but one GET and one PUT: apply many node patches atomically (no lost updates from parallel calls). Use for multi-field or multi-node edits. patches is an array of { nodeId, propsPatch?, mobilePatch?, rootPatch?, nodesPatch?, unset* }.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Site id (defaults to active site)' },
      patches: {
        oneOf: [
          {
            type: 'array',
            items: { type: 'object', properties: patchItemSchemaProps, required: ['nodeId'] },
            description: 'Ordered list of patches; all applied to the same fetched document before save.',
          },
          {
            type: 'string',
            description: 'JSON string of the patches array (for clients that pass stringified payloads).',
          },
        ],
      },
      name: { type: 'string', description: 'Optional site rename on PUT' },
      title: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['patches'],
  },
};

/** Normalize patch fields (parse JSON strings from some MCP clients). */
function normalizeNodePatchArgs(raw) {
  return {
    propsPatch: parseMaybeJson(raw.propsPatch) ?? raw.propsPatch,
    mobilePatch: parseMaybeJson(raw.mobilePatch) ?? raw.mobilePatch,
    rootPatch: parseMaybeJson(raw.rootPatch) ?? raw.rootPatch,
    nodesPatch: raw.nodesPatch,
    unsetProps: raw.unsetProps,
    unsetMobile: raw.unsetMobile,
    unsetRoot: raw.unsetRoot,
  };
}

/* ────────────────────── MCP server setup ────────────────────── */

const MCP_SERVER = new Server(
  { name: 'pagehub-templates', version: '2.0.0' },
  { capabilities: { tools: {} } }
);

MCP_SERVER.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // ── discovery tools (call these first to understand what's available) ──
    {
      name: 'list_sections',
      description:
        'Lists all available pre-built section templates with their IDs, descriptions, component structure, and overridable displayNames. Call this FIRST before using add_section so you know what templates exist and how to customize them.',
      inputSchema: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Optional: filter by category (hero, header, footer, pricing, services, imageText, optin, texts, team, cta, video). Omit for all.' },
        },
      },
    },
    {
      name: 'get_component_schema',
      description:
        'Returns the full schema for all available CraftJS components — their types, props, valid values, and responsive breakpoint patterns. Essential reference when building custom sections with add_custom_section.\n\nIncludes: Container, Text, Image, Button, ButtonList, ImageList, Form, FormElement, Divider, Spacer, Video, Audio, Embed.',
      inputSchema: {
        type: 'object',
        properties: {
          component: { type: 'string', description: 'Optional: get schema for a specific component (e.g. "Container", "Text", "Image"). Omit for all components.' },
        },
      },
    },
    {
      name: 'get_style_reference',
      description:
        'Returns the complete styling reference — palette CSS variables, styleGuide tokens, layout prop keys, responsive patterns, and common Tailwind value examples. Use this to understand what values to put in root/mobile/desktop prop objects.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'get_design_patterns',
      description:
        'Returns concrete CraftJS node structure recipes for building rich, production-quality custom sections. Each pattern is a complete flat node map you can pass directly to add_custom_section (after changing IDs and content).\n\nPatterns cover layouts that pre-built templates do NOT — bento grids, rich contact sections, quote testimonials, menu/offering lists, multi-column footers, etc.\n\nCall this BEFORE building any custom section to get a proven structure instead of guessing.',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Optional: specific pattern name. Available patterns:\n  "bento-gallery" — asymmetric photo grid (2×2 with one tall image)\n  "rich-contact" — hours + address + map placeholder + multi-field form\n  "quote-testimonials" — star ratings + quote cards in a grid\n  "offering-list" — menu/service list with title, description, optional price\n  "split-feature" — text left + image right (or reversed), with eyebrow label\n  "multi-column-footer" — 3-4 column footer with nav links, contact, social\n  "horizontal-scroller" — horizontal scroll strip of tags/categories\nOmit for all patterns.',
          },
        },
      },
    },
    {
      name: 'list_presets',
      description:
        'Lists curated theme presets — complete palette + font + styleGuide bundles tagged by mood. Each preset is a ready-to-use design system. Use a preset ID with set_theme(preset) to apply a complete theme in one call instead of hand-picking 12 colors.',
      inputSchema: {
        type: 'object',
        properties: {
          mood: { type: 'string', description: 'Filter by mood keyword (e.g. "warm", "modern", "dark", "restaurant", "medical"). Omit for all presets.' },
        },
      },
    },
    // ── local template-building tools ──
    {
      name: 'create_template',
      description:
        'Scaffolds a new template from the acme base with an empty page_home container. This is step 1 of building a new template.\n\nWorkflow: create_template → set_theme → add_section (repeat) → set_nav → set_footer → encode_all_templates',
      inputSchema: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'URL-safe slug used as filename and URL path (e.g. "bookstore-jazz", "my-portfolio"). Lowercase, hyphens only.' },
          title: { type: 'string', description: 'Human-readable title for the template gallery (e.g. "Jazz Bookstore").' },
          description: { type: 'string', description: 'Short description ≤75 chars (e.g. "Cozy bookstore with jazz lounge vibes").' },
          image: { type: 'string', description: 'Preview image URL for the template gallery.' },
          hidden: { type: 'boolean', description: 'If true, hidden from public template gallery. Default: false.' },
        },
        required: ['slug'],
      },
    },
    toolSetTheme,
    toolAddSection,
    toolAddCustomSection,
    toolSetNav,
    toolSetFooter,
    {
      name: 'read_template',
      description: 'Returns the full decoded CraftJS node tree JSON for a template. Use this to inspect node IDs, current props, and structure before making edits with update_node. The output is a flat map of nodeId → node definition.',
      inputSchema: {
        type: 'object',
        properties: { slug: { type: 'string', description: 'Template slug to read.' } },
        required: ['slug'],
      },
    },
    {
      name: 'update_node',
      description:
        'Surgically patches a single node in a LOCAL template file. For live API sites, use patch_site_node instead.\n\nPatches are shallow-merged into the target object. Use unset* arrays to remove keys that merges cannot delete.\n\nCommon uses:\n  - Change text: propsPatch: { "text": "New heading" }\n  - Change colors: rootPatch: { "background": "bg-[var(--ph-accent)]", "color": "text-[var(--ph-accent-text)]" }\n  - Change mobile layout: mobilePatch: { "flexDirection": "flex-col", "py": "py-8" }\n  - Change desktop layout: propsPatch: { "desktop": { "gridCols": "grid-cols-3" } }\n  - Reorder children: nodesPatch: ["child2", "child1", "child3"]\n  - Remove a prop: unsetMobile: ["gap"] removes gap from mobile styles',
      inputSchema: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Template slug.' },
          nodeId: { type: 'string', description: 'Node ID to patch. Use read_template to find IDs.' },
          propsPatch: { type: 'object', description: 'Shallow merge into node.props. For desktop overrides: { "desktop": { "gridCols": "grid-cols-2" } }. For text content: { "text": "Hello" }.' },
          mobilePatch: { type: 'object', description: 'Shallow merge into node.props.mobile. Layout props: display, flexDirection, gridCols, gap, width, maxWidth, height, minHeight, py, px, p, my, mx, m, alignItems, justifyContent, overflow, position, inset, zIndex.' },
          rootPatch: { type: 'object', description: 'Shallow merge into node.props.root. Visual props: background, color, border, borderColor, radius, shadow, bgOpacity, fontFamily, fontSize, fontWeight, lineHeight, textAlign, textDecoration. Always use CSS vars: bg-[var(--ph-primary)].' },
          nodesPatch: { type: 'array', items: { type: 'string' }, description: 'REPLACES node.nodes entirely. Use to reorder children. Get current order from read_template first.' },
          unsetProps: { type: 'array', items: { type: 'string' }, description: 'Top-level props keys to delete.' },
          unsetMobile: { type: 'array', items: { type: 'string' }, description: 'Keys to delete from props.mobile.' },
          unsetRoot: { type: 'array', items: { type: 'string' }, description: 'Keys to delete from props.root.' },
        },
        required: ['slug', 'nodeId'],
      },
    },
    {
      name: 'encode_all_templates',
      description: 'Compresses all decoded JSON templates back to lzutf8/base64 encoded format and syncs the template registry. Run this after you\'re done with all edits to finalize the templates.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'delete_node',
      description: 'Deletes a node and all its descendants from a local template. Also removes the node ID from its parent\'s nodes array. Use this to remove unwanted elements, then insert_node to add replacements.\n\nCANNOT delete ROOT, page_home, hdr_root, hdr_section, hdr_inner, ftr_root, ftr_content, ftr_inner — these are structural.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Template slug.' },
          nodeId: { type: 'string', description: 'Node ID to delete. Use read_template to find IDs.' },
        },
        required: ['slug', 'nodeId'],
      },
    },
    {
      name: 'insert_node',
      description: 'Inserts a new node into a local template as a child of an existing parent node. The node definition must include type.resolvedName, isCanvas, props (with root, mobile, desktop, custom.displayName), and an empty nodes array.\n\nUse this to add individual elements (Text, Image, Button, Container, ButtonList, etc.) into existing sections or containers.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Template slug.' },
          nodeId: { type: 'string', description: 'Unique ID for the new node. Use descriptive names like "ftr_brand", "ftr_links".' },
          parentId: { type: 'string', description: 'ID of the parent node to insert into.' },
          position: { type: 'number', description: 'Index in parent\'s nodes array. Default: append to end.' },
          node: {
            type: 'object',
            description: 'Node definition. Must include:\n  type: { resolvedName: "Text" | "Container" | "Image" | "Button" | "ButtonList" | etc }\n  isCanvas: true (containers) or false (leaf elements)\n  props: { canDelete: true, canEditName: true, root: {}, mobile: {}, desktop: {}, text/content/etc, custom: { displayName: "..." } }\n\nparent and linkedNodes are set automatically — do not include them.',
          },
        },
        required: ['slug', 'nodeId', 'parentId', 'node'],
      },
    },
    // ── section library tools ──
    {
      name: 'list_example_sections',
      description: 'Lists all top-level sections in a decoded example template, showing their node IDs, display names, component types, and descendant counts. Use this to find section root IDs before calling extract_section.\n\nHandles both new (page_home) and old (ROOT → random page ID) example formats.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Decoded example slug (e.g. "torrance-liquor", "jp-cleaners", "acme").' },
        },
        required: ['slug'],
      },
    },
    {
      name: 'extract_section',
      description: 'Extracts a section from a decoded example and converts it to hierarchical section template format ({type, props, children}). This is the reverse of add_section — useful for mining existing examples into reusable templates.\n\nUse list_example_sections first to find section root IDs. The output can be passed directly to save_as_section_template.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Decoded example slug to extract from.' },
          sectionRootId: { type: 'string', description: 'Node ID of the section root. Get this from list_example_sections.' },
          templatize: { type: 'boolean', description: 'If true, attempt to replace hardcoded years with {{year}} and flag hardcoded colors for manual palette mapping. Default: false.' },
        },
        required: ['slug', 'sectionRootId'],
      },
    },
    {
      name: 'save_as_section_template',
      description: 'Saves a section template structure into a category file in data/section-templates/. Creates the category file if it doesn\'t exist. Template IDs must be globally unique across all categories.\n\nWorkflow: list_example_sections → extract_section → (review/edit) → save_as_section_template',
      inputSchema: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Category ID (e.g. "hero", "testimonials", "gallery", "contact", "cta"). Maps to data/section-templates/{category}.json.' },
          categoryName: { type: 'string', description: 'Human-readable category name. Only needed when creating a new category file (e.g. "Testimonials", "Contact Sections").' },
          templateId: { type: 'string', description: 'Unique template ID (e.g. "testimonials-1", "gallery-2"). Must be globally unique across all categories.' },
          name: { type: 'string', description: 'Human-readable template name (e.g. "Three-Card Testimonials Grid").' },
          visual: { type: 'string', description: 'Prose description of what the rendered section looks like. Helps AI agents pick the right template.' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Search/filter tags (e.g. ["testimonials", "cards", "three-column", "grid"]).' },
          structure: { type: 'object', description: 'Hierarchical section structure {type, props, children}. Output from extract_section or hand-crafted.' },
        },
        required: ['category', 'templateId', 'name', 'structure'],
      },
    },
    // ── remote API tools ──
    toolRegister,
    toolConfigure,
    toolListTemplates,
    toolPullTemplate,
    toolListSites,
    toolSelectSite,
    toolPullSite,
    toolSaveSite,
    toolDeleteSite,
    toolUploadImage,
    toolPatchSiteNode,
    toolPatchSiteBulk,
  ],
}));

/* ────────────────────── tool handlers ────────────────────── */

MCP_SERVER.setRequestHandler(CallToolRequestSchema, async request => {
  try {
    const name = request.params.name;
    const args = request.params.arguments || {};

    /* ── local: create_template ── */
    if (name === 'create_template') {
      const { slug, title, description, image, hidden } = args;
      const tb = TemplateBuilder.fromAcme(getProjectDir(), {
        slug,
        title: title || 'New Template',
        description: description || '',
        image: image || '',
        hidden: hidden === true,
        homePage: true,
      });
      tb.save();
      return { content: [{ type: 'text', text: `Template ${slug} created (acme base, empty page).` }] };
    }

    /* ── local: set_theme ── */
    if (name === 'set_theme') {
      const {
        slug, title, description, image, demo, homePage, hidden,
        palette, styleGuide, fonts, jsonLd, preset,
      } = args;
      const decodedPath = path.join(getDecodedExamplesDir(), `${slug}.json`);
      let tb;
      if (fs.existsSync(decodedPath)) {
        tb = TemplateBuilder.fromDecoded(getProjectDir(), slug);
      } else {
        tb = TemplateBuilder.fromAcme(getProjectDir(), {
          slug,
          title: title || slug,
          description: description || '',
          image: image || '',
          demo,
          hidden: hidden === true,
          homePage: homePage !== false,
        });
      }
      tb.updateMeta({
        title: title != null ? title : tb.meta.title,
        description: description != null ? description : tb.meta.description,
        image: image != null ? image : tb.meta.image,
        demo: demo != null ? demo : tb.meta.demo,
        homePage: homePage !== undefined ? homePage : tb.meta.homePage,
        hidden: hidden !== undefined ? hidden : tb.meta.hidden,
      });

      /* ── resolve preset defaults (explicit params override) ── */
      let resolvedPalette = parseMaybeJson(palette);
      let resolvedStyleGuide = parseMaybeJson(styleGuide);
      let resolvedFonts = parseMaybeJson(fonts);
      if (preset) {
        const presetsPath = path.join(getProjectDir(), 'data/presets.json');
        if (!fs.existsSync(presetsPath)) throw new Error('No presets.json file found.');
        const presetsData = JSON.parse(fs.readFileSync(presetsPath, 'utf8'));
        const found = (presetsData.presets || []).find(p => p.id === preset);
        if (!found) throw new Error(`Preset "${preset}" not found. Use list_presets to see available presets.`);
        if (!resolvedPalette) resolvedPalette = found.palette;
        if (!resolvedStyleGuide) resolvedStyleGuide = found.styleGuide;
        if (!resolvedFonts) resolvedFonts = found.fonts;
      }

      tb.setTheme({
        palette: resolvedPalette,
        styleGuide: resolvedStyleGuide,
        fonts: resolvedFonts,
        jsonLd: parseMaybeJson(jsonLd),
      });
      tb.save();
      const presetMsg = preset ? ` (preset: ${preset})` : '';
      return { content: [{ type: 'text', text: `Theme saved for ${slug}${presetMsg}.` }] };
    }

    /* ── local: add_section ── */
    if (name === 'add_section') {
      const { slug, templateId, contentOverrides, propOverrides, position } = args;
      const tb = TemplateBuilder.fromDecoded(getProjectDir(), slug);
      tb.addSection(templateId, {
        contentOverrides: parseMaybeJson(contentOverrides) || {},
        propOverrides: parseMaybeJson(propOverrides) || {},
        position,
      });
      tb.save();
      return { content: [{ type: 'text', text: `Section ${templateId} added to ${slug}.` }] };
    }

    /* ── local: add_custom_section ── */
    if (name === 'add_custom_section') {
      const { slug, sectionRootId, nodes, parentNodeId, position } = args;
      const tb = TemplateBuilder.fromDecoded(getProjectDir(), slug);
      const nodeMap = parseMaybeJson(nodes);
      if (!nodeMap || typeof nodeMap !== 'object') throw new Error('nodes must be an object map');
      // Validate all image URLs in the node map
      const allImgUrls = collectAllImageUrls(nodeMap);
      if (allImgUrls.length > 0) {
        const failures = await validateImageUrls(allImgUrls.map(u => u.url));
        if (failures.length > 0) {
          const msg = failures.map(f => {
            const nodeRef = allImgUrls.find(u => u.url === f.url);
            return `  ${nodeRef?.nodeId || '?'}: ${f.url} → ${f.status}`;
          }).join('\n');
          throw new Error(`Image validation failed — these URLs are broken:\n${msg}\n\nFix the URLs and try again.`);
        }
      }
      tb.addCustomSection(sectionRootId, nodeMap, { parentNodeId, position });
      tb.save();
      return { content: [{ type: 'text', text: `Custom section ${sectionRootId} merged into ${slug}. (${allImgUrls.length} image URLs validated)` }] };
    }

    /* ── local: set_nav ── */
    if (name === 'set_nav') {
      const { slug, menuId, menuTitle, logoText, logoFont, headerBg, headerColor, links, phone } = args;
      const tb = TemplateBuilder.fromDecoded(getProjectDir(), slug);
      tb.setNav({
        menuId, menuTitle, logoText, logoFont, headerBg, headerColor,
        links: parseMaybeJson(links) || [],
        phone: parseMaybeJson(phone),
      });
      tb.save();
      return { content: [{ type: 'text', text: `Nav updated for ${slug}.` }] };
    }

    /* ── local: set_footer ── */
    if (name === 'set_footer') {
      const { slug, contentBackground, contentColor, copyrightHtml, copyrightTagName, copyrightRootColor } = args;
      const tb = TemplateBuilder.fromDecoded(getProjectDir(), slug);
      tb.setFooter({ contentBackground, contentColor, copyrightHtml, copyrightTagName, copyrightRootColor });
      tb.save();
      return { content: [{ type: 'text', text: `Footer updated for ${slug}.` }] };
    }

    /* ── local: read_template ── */
    if (name === 'read_template') {
      const { slug } = args;
      const parsed = JSON.parse(fs.readFileSync(path.join(getDecodedExamplesDir(), `${slug}.json`), 'utf-8'));
      return { content: [{ type: 'text', text: JSON.stringify(parsed, null, 2) }] };
    }

    /* ── local: update_node ── */
    if (name === 'update_node') {
      await fsMutex.lock();
      try {
        const { slug, nodeId, ...patches } = args;
        const filePath = path.join(getDecodedExamplesDir(), `${slug}.json`);
        const parsed = JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
        // Validate image URLs if content or backgroundImage is being patched
        const patchedProps = patches.propsPatch ? parseMaybeJson(patches.propsPatch) : {};
        const imgUrls = [];
        if (patchedProps?.content && typeof patchedProps.content === 'string' && patchedProps.content.startsWith('http')) {
          imgUrls.push(patchedProps.content);
        }
        if (patchedProps?.backgroundImage && typeof patchedProps.backgroundImage === 'string' && patchedProps.backgroundImage.startsWith('http')) {
          imgUrls.push(patchedProps.backgroundImage);
        }
        if (imgUrls.length > 0) {
          const failures = await validateImageUrls(imgUrls);
          if (failures.length > 0) {
            const msg = failures.map(f => `  ${f.url} → ${f.status}`).join('\n');
            throw new Error(`Image validation failed — these URLs are broken:\n${msg}\n\nFix the URLs and try again.`);
          }
        }
        applyNodePatches(parsed, nodeId, patches);
        await fs.promises.writeFile(filePath, JSON.stringify(parsed, null, 2));
        runEncode();
        runSyncRegistry();
        return { content: [{ type: 'text', text: `Node ${nodeId} in ${slug} updated.` }] };
      } finally {
        fsMutex.release();
      }
    }

    /* ── local: encode_all_templates ── */
    if (name === 'encode_all_templates') {
      const stdout = execSync('node scripts/examples.js encode', { cwd: getProjectDir() });
      runSyncRegistry();
      return { content: [{ type: 'text', text: stdout.toString() }] };
    }

    /* ── local: delete_node ── */
    if (name === 'delete_node') {
      await fsMutex.lock();
      try {
        const { slug, nodeId } = args;
        const protectedIds = ['ROOT', 'page_home', 'hdr_root', 'hdr_section', 'hdr_inner', 'ftr_root', 'ftr_content', 'ftr_inner'];
        if (protectedIds.includes(nodeId)) throw new Error(`Cannot delete structural node: ${nodeId}`);
        const filePath = path.join(getDecodedExamplesDir(), `${slug}.json`);
        const parsed = JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
        if (!parsed[nodeId]) throw new Error(`Node ${nodeId} not found`);
        // Remove from parent's nodes array
        const parentId = parsed[nodeId].parent;
        if (parentId && parsed[parentId]) {
          parsed[parentId].nodes = (parsed[parentId].nodes || []).filter(id => id !== nodeId);
        }
        // Delete node and all descendants
        const deleteSubtree = (id) => {
          const n = parsed[id];
          if (!n) return;
          for (const c of [...(n.nodes || [])]) deleteSubtree(c);
          delete parsed[id];
        };
        deleteSubtree(nodeId);
        await fs.promises.writeFile(filePath, JSON.stringify(parsed, null, 2));
        runEncode();
        runSyncRegistry();
        return { content: [{ type: 'text', text: `Node ${nodeId} (and descendants) deleted from ${slug}.` }] };
      } finally {
        fsMutex.release();
      }
    }

    /* ── local: insert_node ── */
    if (name === 'insert_node') {
      await fsMutex.lock();
      try {
        const { slug, nodeId, parentId, position, node } = args;
        const filePath = path.join(getDecodedExamplesDir(), `${slug}.json`);
        const parsed = JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
        if (parsed[nodeId]) throw new Error(`Node ID "${nodeId}" already exists. Use a unique ID.`);
        if (!parsed[parentId]) throw new Error(`Parent node "${parentId}" not found.`);
        const nodeDef = parseMaybeJson(node) || node;
        // Set parent and ensure linkedNodes
        nodeDef.parent = parentId;
        if (!nodeDef.linkedNodes) nodeDef.linkedNodes = {};
        if (!nodeDef.nodes) nodeDef.nodes = [];
        if (!nodeDef.hidden) nodeDef.hidden = false;
        if (!nodeDef.displayName && nodeDef.type?.resolvedName) nodeDef.displayName = nodeDef.type.resolvedName;
        // Validate image URLs before inserting
        const imgUrls = extractImageUrls(nodeDef.props, nodeDef.type?.resolvedName);
        if (imgUrls.length > 0) {
          const failures = await validateImageUrls(imgUrls);
          if (failures.length > 0) {
            const msg = failures.map(f => `  ${f.url} → ${f.status}`).join('\n');
            throw new Error(`Image validation failed — these URLs are broken:\n${msg}\n\nFix the URLs and try again.`);
          }
        }
        parsed[nodeId] = nodeDef;
        // Add to parent's nodes array
        const list = parsed[parentId].nodes || (parsed[parentId].nodes = []);
        const pos = position != null ? position : list.length;
        list.splice(pos, 0, nodeId);
        await fs.promises.writeFile(filePath, JSON.stringify(parsed, null, 2));
        runEncode();
        runSyncRegistry();
        return { content: [{ type: 'text', text: `Node ${nodeId} inserted into ${parentId} at position ${pos} in ${slug}.` }] };
      } finally {
        fsMutex.release();
      }
    }

    /* ── section library: list_example_sections ── */
    if (name === 'list_example_sections') {
      const { slug } = args;
      const filePath = path.join(getDecodedExamplesDir(), `${slug}.json`);
      if (!fs.existsSync(filePath)) throw new Error(`Decoded file not found: ${slug}.json`);
      const nodes = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const sections = TemplateBuilder.listSections(nodes);
      if (sections.length === 0) {
        return { content: [{ type: 'text', text: `No sections found in ${slug}. The page container may be empty.` }] };
      }
      const lines = sections.map((s, i) =>
        `${i + 1}. **${s.id}** — "${s.displayName}" (${s.type}, ${s.childCount} descendants)`
      );
      return {
        content: [{
          type: 'text',
          text: `# Sections in ${slug}\n\nUse these IDs with extract_section(slug, sectionRootId).\n\n${lines.join('\n')}`,
        }],
      };
    }

    /* ── section library: extract_section ── */
    if (name === 'extract_section') {
      const { slug, sectionRootId, templatize } = args;
      const filePath = path.join(getDecodedExamplesDir(), `${slug}.json`);
      if (!fs.existsSync(filePath)) throw new Error(`Decoded file not found: ${slug}.json`);
      const nodes = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const structure = TemplateBuilder.extractSection(nodes, sectionRootId, { templatize: templatize === true });
      return {
        content: [{
          type: 'text',
          text: `# Extracted Section: ${sectionRootId} from ${slug}\n\nPass this structure to save_as_section_template to save it as a reusable template.\n\n\`\`\`json\n${JSON.stringify(structure, null, 2)}\n\`\`\``,
        }],
      };
    }

    /* ── section library: save_as_section_template ── */
    if (name === 'save_as_section_template') {
      const { category, categoryName, templateId, name: tplName, visual, tags, structure } = args;

      // Global uniqueness check across all category files
      const sectionsDir = path.join(getProjectDir(), 'data/section-templates');
      for (const f of fs.readdirSync(sectionsDir).filter(f => f.endsWith('.json'))) {
        try {
          const d = JSON.parse(fs.readFileSync(path.join(sectionsDir, f), 'utf8'));
          if ((d.templates || []).some(t => t.id === templateId)) {
            throw new Error(`Template ID "${templateId}" already exists in ${f}. Use a different ID.`);
          }
        } catch (e) {
          if (e.message.includes('already exists')) throw e;
          /* skip unparseable files */
        }
      }

      const catPath = path.join(sectionsDir, `${category}.json`);
      let catData;
      if (fs.existsSync(catPath)) {
        catData = JSON.parse(fs.readFileSync(catPath, 'utf8'));
      } else {
        // New category — auto-assign order
        let maxOrder = 0;
        for (const f of fs.readdirSync(sectionsDir).filter(f => f.endsWith('.json'))) {
          try {
            const d = JSON.parse(fs.readFileSync(path.join(sectionsDir, f), 'utf8'));
            if (d.order > maxOrder) maxOrder = d.order;
          } catch { /* skip */ }
        }
        catData = {
          id: category,
          name: categoryName || category.charAt(0).toUpperCase() + category.slice(1),
          order: maxOrder + 1,
          templates: [],
        };
      }

      const entry = { id: templateId, name: tplName };
      if (visual) entry.visual = visual;
      if (tags?.length) entry.tags = parseMaybeJson(tags) || tags;
      entry.structure = parseMaybeJson(structure) || structure;

      catData.templates.push(entry);
      fs.writeFileSync(catPath, JSON.stringify(catData, null, 2) + '\n', 'utf8');

      return {
        content: [{
          type: 'text',
          text: `Template "${templateId}" saved to ${category}.json (${catData.templates.length} total templates in category). Use add_section(slug, "${templateId}") to use it.`,
        }],
      };
    }

    /* ── discovery: list_sections ── */
    if (name === 'list_sections') {
      const sectionsDir = path.join(getProjectDir(), 'data/section-templates');
      const result = [];
      const files = fs.readdirSync(sectionsDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const cat = JSON.parse(fs.readFileSync(path.join(sectionsDir, file), 'utf8'));
        if (args.category && cat.id !== args.category) continue;
        if (!cat.templates || cat.templates.length === 0) {
          result.push(`\n## ${cat.name} (${cat.id}) — no templates yet`);
          continue;
        }
        result.push(`\n## ${cat.name} (${cat.id})`);
        for (const tpl of cat.templates) {
          const displayNames = [];
          const collectNames = (node, depth) => {
            if (!node) return;
            const dn = node.props?.custom?.displayName;
            const type = node.type || 'Unknown';
            if (dn) displayNames.push({ name: dn, type, depth });
            if (node.children) node.children.forEach(c => collectNames(c, depth + 1));
          };
          if (tpl.structure) collectNames(tpl.structure, 0);
          const nameList = displayNames.map(d => `${'  '.repeat(d.depth)}• "${d.name}" (${d.type})`).join('\n');
          const visual = tpl.visual ? `\nVisual: ${tpl.visual}` : '';
          const tags = tpl.tags?.length ? `\nTags: ${tpl.tags.join(', ')}` : '';
          result.push(`\n### ${tpl.id} — "${tpl.name}"${visual}${tags}\nOverridable nodes (by displayName):\n${nameList || '  (none)'}`);
        }
      }
      return {
        content: [{
          type: 'text',
          text: `# Available Section Templates\n\nUse these IDs with add_section(slug, templateId). Override content/styling by displayName.\n${result.join('\n')}`,
        }],
      };
    }

    /* ── discovery: get_component_schema ── */
    if (name === 'get_component_schema') {
      const schemas = {
        Container: {
          description: 'Main layout block — sections, rows, columns, cards, wrappers. The most-used component.',
          isCanvas: true,
          props: {
            type: '(string) "section" | "page" | "header" | "footer" — determines layout role. Sections get canDelete: true.',
            canDelete: '(boolean) Allow deletion in editor.',
            canEditName: '(boolean) Allow renaming in editor.',
            'custom.displayName': '(string) Human-readable name shown in editor and used for contentOverrides/propOverrides matching.',
            role: '(string) ARIA role (e.g. "banner", "main", "contentinfo", "navigation").',
            'aria-label': '(string) Accessibility label.',
          },
          mobile: {
            display: '"flex" | "grid" | "block" | "none" | "inline-flex"',
            flexDirection: '"flex-row" | "flex-col" | "flex-row-reverse" | "flex-col-reverse"',
            flexWrap: '"flex-wrap" | "flex-nowrap"',
            flex: '"flex-1" | "flex-none" | "flex-auto"',
            gridCols: '"grid-cols-1" | "grid-cols-2" | "grid-cols-3" | "grid-cols-4" — NOT gridTemplateColumns',
            gap: '"gap-2" | "gap-4" | "gap-8" | "gap-[var(--ph-container-gap)]"',
            alignItems: '"items-start" | "items-center" | "items-end" | "items-stretch"',
            justifyContent: '"justify-start" | "justify-center" | "justify-end" | "justify-between" | "justify-around"',
            width: '"w-full" | "w-auto" | "w-1/2" | "w-[75%]"',
            maxWidth: '"max-w-[var(--ph-content-width)]" | "max-w-4xl" | "max-w-none"',
            minHeight: '"min-h-screen" | "min-h-[60vh]" | "min-h-0"',
            height: '"h-auto" | "h-screen" | "h-64" | "h-[400px]"',
            py: '"py-4" | "py-8" | "py-12" | "py-20" | "py-[var(--ph-container-padding-y)]"',
            px: '"px-4" | "px-6" | "px-8" | "px-[var(--ph-container-padding-x)]"',
            p: '"p-4" | "p-8"',
            my: '"my-0" | "my-4" | "my-auto"',
            mx: '"mx-auto" | "mx-0"',
            overflow: '"overflow-hidden" | "overflow-auto" | "overflow-visible"',
            position: '"relative" | "absolute" | "fixed" | "sticky"',
            inset: '"inset-0" (fills parent when position: absolute)',
            zIndex: '"z-10" | "z-20" | "z-50"',
          },
          root: {
            background: '"bg-[var(--ph-primary)]" | "bg-[var(--ph-background)]" | "bg-[var(--ph-alternate-background)]" | "bg-transparent"',
            color: '"text-[var(--ph-text)]" | "text-[var(--ph-primary-text)]" — MUST match background',
            border: '"border" | "border-2" | "border-b"',
            borderColor: '"border-[var(--ph-alternate-background)]"',
            radius: '"rounded-lg" | "rounded-xl" | "rounded-[var(--ph-border-radius)]"',
            shadow: '"shadow-sm" | "shadow-md" | "shadow-[var(--ph-shadow-style)]"',
            animation: '"spring" (fade+scale in on scroll, once) | "hoverGrow" (scale on hover) — apply to cards, gallery images for scroll-reveal effects. Don\'t overuse.',
          },
          interactivity: {
            id: '(string) DOM id for the rendered element. Required when this container is a target for click show/hide/toggle. Example: "tab-coffee", "mobile-menu". Used with Button click.value to reference this element.',
          },
        },
        Text: {
          description: 'Single-purpose text element. ONE Text node = ONE piece of content (a heading, a paragraph, a caption). NEVER cram multiple content types into one Text node with <br/> separators — use separate Text nodes instead so each gets its own styling.',
          isCanvas: false,
          props: {
            text: '(string) Text content for a SINGLE purpose. Supports inline formatting only: <strong>, <em>, <span style="...">. Use <br/> ONLY for line breaks within the same content block (e.g. multi-line poem), never to separate different content types. NEVER use <p>, <div>, <h1>-<h6>, or <a> tags — use tagName for the wrapper, Button components for links. Use {{company.name}}, {{year}} etc. for dynamic content.',
            tagName: '"h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span" | "div" — sets the wrapper HTML element. Choose based on semantic meaning: h1-h6 for headings, p for paragraphs, span for inline labels.',
          },
          mobile: 'Same layout props as Container, plus: fontSize ("text-sm" | "text-base" | "text-lg" | "text-xl" | "text-2xl" | "text-3xl" | "text-4xl" | "text-5xl"), lineHeight ("leading-tight" | "leading-normal" | "leading-relaxed")',
          root: 'Same visual props as Container, plus: fontWeight ("font-normal" | "font-medium" | "font-semibold" | "font-bold"), textAlign ("text-left" | "text-center" | "text-right"), textDecoration ("underline" | "no-underline"), fontFamily ("font-[var(--ph-heading-font-family)]")',
        },
        Image: {
          description: 'Image component. Supports external URLs, CDN media IDs, and inline SVGs.',
          isCanvas: false,
          props: {
            content: '(string) Image source — URL for type "url", media ID for type "cdn", SVG markup for type "svg".',
            type: '"url" | "cdn" | "svg" | "upload" — source type. Use "url" for external images (Unsplash etc), "cdn" for uploaded media.',
            alt: '(string) Alt text for accessibility.',
            objectFit: '"object-cover" | "object-contain" | "object-fill" | "object-none"',
            loading: '"lazy" | "eager" — lazy-load by default, eager for above-fold hero images.',
          },
          mobile: 'Layout props plus: height ("h-48" | "h-64" | "h-96" | "h-[400px]"), width ("w-full")',
          root: 'radius ("rounded-lg"), shadow, border, borderColor',
        },
        Button: {
          description: 'Interactive button/link. Usually placed inside a ButtonList container.',
          isCanvas: false,
          props: {
            text: '(string) Button label text.',
            url: '(string) Link URL. "#id" for anchors, "/path" for internal, full URL for external. "tel:{{company.phone}}", "mailto:{{company.email}}" for contact.',
            type: '"button" | "submit" | "reset" — HTML button type. Use "submit" inside Form components.',
            icon: '(object) Optional icon using Google Material Symbols (2000+ icons). Format: { value: "ref-google:icon_name", position: "left" | "right", size: "w-5 h-5" | "w-6 h-6", gap: "gap-2", only: false }. Set only: true to hide text and show icon only (e.g. hamburger menu). Common icons: menu, close, phone, mail, location_on, star, arrow_forward, coffee, restaurant, schedule, storefront, music_note, check_circle, expand_more, open_in_new, facebook, photo_camera. Browse all at fonts.google.com/icons. NEVER use emoji characters as icons — always use ref-google: format.',
            click: '(object) Click action — show/hide/toggle another element by DOM id. Format: { type: "click", direction: "show" | "hide" | "toggle", value: "dom-element-id" }. The target element must have an "id" prop matching the value. Use for: mobile menu toggles (toggle), tab content switching (show/hide), expandable sections. For tabs: one button shows panel A, another shows panel B. Target panels start hidden with mobile.display: "hidden".',
          },
          mobile: 'Layout props (width, py, px, display)',
          root: 'background, color, border, borderColor, radius, shadow, fontWeight, fontSize',
        },
        ButtonList: {
          description: 'Container for multiple Button children. Renders children in a flex row/col layout.',
          isCanvas: true,
          props: { 'custom.displayName': 'e.g. "Navigation", "CTA Buttons"' },
          mobile: 'display, flexDirection, gap, alignItems, justifyContent, flexWrap',
          root: 'No visual props typically — styling goes on individual Button children.',
        },
        ImageList: {
          description: 'Container for multiple Image children. Used for galleries and photo grids.',
          isCanvas: true,
          mobile: 'display ("grid"), gridCols, gap',
          root: 'No visual props typically.',
        },
        Form: {
          description: 'Form container wrapping FormElement children and a submit Button.',
          isCanvas: true,
          props: {
            formName: '(string) Form identifier (e.g. "contact", "newsletter").',
            formSettings: '(object) Advanced form config.',
          },
          mobile: 'Same as Container',
          root: 'Same as Container',
        },
        FormElement: {
          description: 'Individual form input field. Must be a child of Form. IMPORTANT: Every FormElement MUST have explicit root and mobile styling — empty root: {} produces unstyled inputs because CraftJS overrides component defaults.',
          isCanvas: false,
          props: {
            type: '"text" | "email" | "number" | "textarea" | "select" | "tel" | "url" | "date" | "checkbox" | "radio"',
            label: '(string) Field label.',
            name: '(string) Form field name (e.g. "email", "name", "message").',
            placeholder: '(string) Placeholder text.',
            required: '(boolean) Whether field is required.',
            options: '(array) For select/radio: [{ label: "Option 1", value: "opt1" }]',
          },
          requiredStyling: 'EVERY FormElement MUST have this exact root and mobile — copy verbatim:\n\nroot: { "border": "border", "borderWidth": "border-[var(--ph-input-border-width)]", "borderStyle": "border-solid", "borderColor": "border-[color:var(--ph-input-border-color)]", "radius": "rounded-[var(--ph-input-border-radius)]", "background": "bg-[var(--ph-input-bg-color)]", "color": "text-[color:var(--ph-input-text-color)]" }\n\nmobile: { "p": "p-[var(--ph-input-padding)]", "width": "w-full" }\n\nThese CSS variables are set by the styleGuide input tokens in set_theme. Without this block, inputs render with no visible border, no padding, and no background.',
        },
        Divider: { description: 'Visual horizontal separator line.', isCanvas: false, root: 'border, borderColor, my' },
        Spacer: { description: 'Empty vertical/horizontal space.', isCanvas: false, mobile: 'height ("h-8" | "h-16")' },
        Video: { description: 'Video player (YouTube, Vimeo, direct).', isCanvas: false, props: { content: '(string) Video URL.', controls: '(boolean)', autoplay: '(boolean)' } },
        Audio: { description: 'Audio player.', isCanvas: false, props: { content: '(string) Audio URL.', controls: '(boolean)', autoplay: '(boolean)' } },
        Embed: { description: 'Iframe/embed for third-party content (maps, widgets, etc).', isCanvas: false, props: { content: '(string) Embed HTML or URL.', type: '"iframe" | "embed"' } },
      };

      if (args.component) {
        const s = schemas[args.component];
        if (!s) return { content: [{ type: 'text', text: `Unknown component: ${args.component}. Available: ${Object.keys(schemas).join(', ')}` }] };
        return { content: [{ type: 'text', text: JSON.stringify({ [args.component]: s }, null, 2) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(schemas, null, 2) }] };
    }

    /* ── discovery: get_style_reference ── */
    if (name === 'get_style_reference') {
      const ref = `# PageHub Style Reference

## Palette CSS Variables (set via set_theme palette array)

| Variable | Slot | Typical Use |
|----------|------|-------------|
| var(--ph-primary) | 0 | Main brand color (buttons, links, hero backgrounds) |
| var(--ph-primary-text) | 1 | Text on primary backgrounds |
| var(--ph-secondary) | 2 | Supporting color (cards, badges, secondary buttons) |
| var(--ph-secondary-text) | 3 | Text on secondary backgrounds |
| var(--ph-accent) | 4 | CTA/highlight color (call-to-action buttons, emphasis) |
| var(--ph-accent-text) | 5 | Text on accent backgrounds |
| var(--ph-neutral) | 6 | Muted color (borders, disabled, subtle backgrounds) |
| var(--ph-neutral-text) | 7 | Text on neutral backgrounds |
| var(--ph-background) | 8 | Page/site background |
| var(--ph-text) | 9 | Default body text |
| var(--ph-alternate-background) | 10 | Alternate section backgrounds, cards, dividers |
| var(--ph-alternate-text) | 11 | Text on alternate backgrounds |

## Style Guide CSS Variables (set via set_theme styleGuide)

| Variable | Key | Default |
|----------|-----|---------|
| --ph-border-radius | borderRadius | 0.5rem |
| --ph-button-padding-x / -y | buttonPadding | 1.5rem 0.75rem |
| --ph-container-padding / -x / -y | containerPadding | 2rem 2rem |
| --ph-section-gap | sectionGap | 4rem |
| --ph-container-gap | containerGap | 1.5rem |
| --ph-content-width | contentWidth | 80rem |
| --ph-shadow-style | shadowStyle | 0 1px 3px rgba(0,0,0,0.1) |
| --ph-heading-font-family | headingFontFamily | (from Google Fonts) |
| --ph-body-font-family | bodyFontFamily | (from Google Fonts) |

## Using Variables in Props

ALWAYS use CSS variables via Tailwind arbitrary syntax — never hardcode hex or named colors:

✅ Correct:
  root.background: "bg-[var(--ph-primary)]"
  root.color: "text-[var(--ph-primary-text)]"
  root.borderColor: "border-[var(--ph-alternate-background)]"
  root.radius: "rounded-[var(--ph-border-radius)]"
  mobile.gap: "gap-[var(--ph-container-gap)]"
  mobile.maxWidth: "max-w-[var(--ph-content-width)]"

❌ Wrong:
  root.background: "bg-black"
  root.color: "text-white"
  root.color: "text-[#1e293b]"
  root.borderColor: "border-gray-200"

Exception: bg-transparent, bg-white/10 (opacity modifiers) are OK.

## Responsive Pattern (Mobile-First)

props.mobile → base styles (no Tailwind prefix)
props.desktop → md: prefixed styles (auto-applied)

Common responsive pattern:
  mobile: { display: "flex", flexDirection: "flex-col", gridCols: "grid-cols-1" }
  desktop: { display: "grid", flexDirection: "flex-row", gridCols: "grid-cols-3" }

Hide on mobile, show on desktop:
  mobile: { display: "none" }
  desktop: { display: "flex" }

## Layout Prop Keys (in mobile/desktop objects)

| Key | Values | Notes |
|-----|--------|-------|
| display | flex, grid, block, none, inline-flex | |
| flexDirection | flex-row, flex-col, flex-row-reverse, flex-col-reverse | |
| gridCols | grid-cols-1 through grid-cols-12 | NOT gridTemplateColumns |
| gap | gap-0 through gap-16, gap-[var(--ph-container-gap)] | |
| alignItems | items-start, items-center, items-end, items-stretch | |
| justifyContent | justify-start, justify-center, justify-end, justify-between | |
| width | w-full, w-auto, w-1/2, w-1/3, w-[75%] | |
| maxWidth | max-w-[var(--ph-content-width)], max-w-4xl, max-w-none | |
| height | h-auto, h-screen, h-64, h-[400px] | |
| minHeight | min-h-screen, min-h-[60vh] | |
| py | py-0 through py-32, py-[var(--ph-container-padding-y)] | |
| px | px-0 through px-16, px-[var(--ph-container-padding-x)] | |
| mx | mx-auto (centering), mx-0 | |
| position | relative, absolute, fixed, sticky | |
| inset | inset-0 (fills positioned parent) | |
| zIndex | z-10, z-20, z-50 | |
| overflow | overflow-hidden, overflow-auto, overflow-visible | |
| flex | flex-1, flex-none, flex-auto | |

## Visual Prop Keys (in root object)

| Key | Values |
|-----|--------|
| background | bg-[var(--ph-*)], bg-transparent |
| color | text-[var(--ph-*)] |
| border | border, border-2, border-b |
| borderColor | border-[var(--ph-*)] |
| radius | rounded-lg, rounded-xl, rounded-[var(--ph-border-radius)] |
| shadow | shadow-sm, shadow-md, shadow-[var(--ph-shadow-style)] |
| fontSize | text-sm through text-6xl |
| fontWeight | font-normal, font-medium, font-semibold, font-bold |
| fontFamily | font-[var(--ph-heading-font-family)], font-[var(--ph-body-font-family)] |
| textAlign | text-left, text-center, text-right |
| lineHeight | leading-tight, leading-normal, leading-relaxed |
| textDecoration | underline, no-underline |

## Template Variables

Use these in Text node text values and Button URLs — never hardcode company info:

| Variable | Example Default |
|----------|----------------|
| {{company.name}} | Acme Inc. |
| {{company.tagline}} | The ultimate solution |
| {{company.type}} | technology |
| {{company.location}} | Los Angeles, CA |
| {{company.address}} | 123 Main St, Suite 100 |
| {{company.phone}} | (555) 123-4567 |
| {{company.email}} | contact@acme.com |
| {{company.website}} | https://www.acme.com |
| {{year}} | (current year, dynamic) |

## Key Rules

1. Page containers (type: "page") must NOT have gap, py, px, p, my, mx — spacing goes on sections.
2. ROOT node must NOT have gap or spacing — it pushes apart header/page/footer.
3. Text "text" values: NO <p>, <div>, <h1>-<h6> tags. Use tagName prop for the wrapper element. Only inline tags: <strong>, <em>, <br/>, <span>, <a>, <ul>/<li>.
4. Always match text color to background: bg-[var(--ph-primary)] → text-[var(--ph-primary-text)].
5. Use descriptive node IDs: "sec_hero", "hero_title", "sec_testimonials", "card_1", etc.
`;
      return { content: [{ type: 'text', text: ref }] };
    }

    /* ── discovery: get_design_patterns ── */
    if (name === 'get_design_patterns') {
      const patterns = {};

      patterns['bento-gallery'] = {
        description: 'Asymmetric photo grid — 2 landscape images on top, 1 tall portrait + 1 info card on bottom. Creates visual interest without masonry JS. Great for "The Space", gallery, or portfolio sections.',
        usage: 'Change image URLs, alt text, card content. Adjust grid ratios with gridCols and row spans.',
        nodes: {
          sec_gallery: {
            type: { resolvedName: 'Container' }, isCanvas: true,
            props: { canDelete: true, canEditName: true, type: 'section',
              root: { background: 'bg-[var(--ph-alternate-background)]' },
              mobile: { display: 'flex', flexDirection: 'flex-col', width: 'w-full', py: 'py-16', px: 'px-[var(--ph-container-padding-x)]' },
              desktop: { py: 'py-24' },
              custom: { displayName: 'Gallery Section' } },
            displayName: 'Container', parent: 'page_home', nodes: ['gallery_header', 'gallery_grid'], linkedNodes: {}
          },
          gallery_header: {
            type: { resolvedName: 'Container' }, isCanvas: true,
            props: { canDelete: true, canEditName: true, root: {},
              mobile: { display: 'flex', flexDirection: 'flex-col', alignItems: 'items-center', gap: 'gap-2', width: 'w-full', maxWidth: 'max-w-[var(--ph-content-width)]', mx: 'mx-auto', mb: 'mb-12' },
              desktop: {},
              custom: { displayName: 'Gallery Header' } },
            displayName: 'Container', parent: 'sec_gallery', nodes: ['gallery_eyebrow', 'gallery_title'], linkedNodes: {}
          },
          gallery_eyebrow: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-accent)]', fontFamily: 'var(--ph-body-font-family)' },
              mobile: { fontSize: 'text-xs', fontWeight: 'font-bold', letterSpacing: 'tracking-widest', textAlign: 'text-center' },
              desktop: {}, text: 'EXPERIENCE · EXPLORE', tagName: 'p',
              custom: { displayName: 'Eyebrow' } },
            displayName: 'Text', parent: 'gallery_header', nodes: [], linkedNodes: {}
          },
          gallery_title: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-primary)]', fontFamily: 'var(--ph-heading-font-family)' },
              mobile: { fontSize: 'text-3xl', fontWeight: 'font-bold', textAlign: 'text-center' },
              desktop: { fontSize: 'text-4xl' }, text: 'The Space', tagName: 'h2',
              custom: { displayName: 'Title' } },
            displayName: 'Text', parent: 'gallery_header', nodes: [], linkedNodes: {}
          },
          gallery_grid: {
            type: { resolvedName: 'Container' }, isCanvas: true,
            props: { canDelete: true, canEditName: true, root: {},
              mobile: { display: 'grid', gridCols: 'grid-cols-1', gap: 'gap-4', width: 'w-full', maxWidth: 'max-w-[var(--ph-content-width)]', mx: 'mx-auto' },
              desktop: { gridCols: 'grid-cols-4' },
              custom: { displayName: 'Grid' } },
            displayName: 'Container', parent: 'sec_gallery', nodes: ['gallery_img1', 'gallery_img2', 'gallery_img3', 'gallery_card'], linkedNodes: {}
          },
          gallery_img1: {
            type: { resolvedName: 'Image' }, isCanvas: false,
            props: { canDelete: true, canEditName: true, type: 'url',
              content: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600',
              alt: 'Interior view', root: { radius: 'rounded-[var(--ph-border-radius)]' },
              mobile: { width: 'w-full', height: 'h-[250px]', objectFit: 'object-cover' },
              desktop: { height: 'h-[300px]', gridCols: 'col-span-2' },
              custom: { displayName: 'Photo 1' } },
            displayName: 'Image', parent: 'gallery_grid', nodes: [], linkedNodes: {}
          },
          gallery_img2: {
            type: { resolvedName: 'Image' }, isCanvas: false,
            props: { canDelete: true, canEditName: true, type: 'url',
              content: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600',
              alt: 'Detail shot', root: { radius: 'rounded-[var(--ph-border-radius)]' },
              mobile: { width: 'w-full', height: 'h-[250px]', objectFit: 'object-cover' },
              desktop: { height: 'h-[300px]', gridCols: 'col-span-2' },
              custom: { displayName: 'Photo 2' } },
            displayName: 'Image', parent: 'gallery_grid', nodes: [], linkedNodes: {}
          },
          gallery_img3: {
            type: { resolvedName: 'Image' }, isCanvas: false,
            props: { canDelete: true, canEditName: true, type: 'url',
              content: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600',
              alt: 'Atmosphere shot', root: { radius: 'rounded-[var(--ph-border-radius)]' },
              mobile: { width: 'w-full', height: 'h-[250px]', objectFit: 'object-cover' },
              desktop: { height: 'h-[320px]', gridCols: 'col-span-2' },
              custom: { displayName: 'Photo 3' } },
            displayName: 'Image', parent: 'gallery_grid', nodes: [], linkedNodes: {}
          },
          gallery_card: {
            type: { resolvedName: 'Container' }, isCanvas: true,
            props: { canDelete: true, canEditName: true,
              root: { background: 'bg-[var(--ph-background)]', radius: 'rounded-[var(--ph-border-radius)]', shadow: 'shadow-lg' },
              mobile: { display: 'flex', flexDirection: 'flex-col', justifyContent: 'justify-center', p: 'p-8', gap: 'gap-3', width: 'w-full', height: 'h-full' },
              desktop: { gridCols: 'col-span-2' },
              custom: { displayName: 'Info Card' } },
            displayName: 'Container', parent: 'gallery_grid', nodes: ['gallery_card_title', 'gallery_card_body'], linkedNodes: {}
          },
          gallery_card_title: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-primary)]', fontFamily: 'var(--ph-heading-font-family)' },
              mobile: { fontSize: 'text-xl', fontWeight: 'font-bold' },
              desktop: {}, text: 'Coworking', tagName: 'h3',
              custom: { displayName: 'Card Title' } },
            displayName: 'Text', parent: 'gallery_card', nodes: [], linkedNodes: {}
          },
          gallery_card_body: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-alternate-text)]' },
              mobile: { fontSize: 'text-sm', lineHeight: 'leading-relaxed' },
              desktop: {}, text: 'Grab a table, plug in, and work while the espresso machine hums in the background.', tagName: 'p',
              custom: { displayName: 'Card Body' } },
            displayName: 'Text', parent: 'gallery_card', nodes: [], linkedNodes: {}
          },
        },
      };

      patterns['rich-contact'] = {
        description: 'Full contact section — left side has heading + address + hours table, right side has a multi-field form (name, email, message + submit). Two equal columns on desktop, stacked on mobile. Alternate background.',
        usage: 'Change heading, address, hours, form fields. Adjust column widths.',
        nodes: {
          sec_contact: {
            type: { resolvedName: 'Container' }, isCanvas: true,
            props: { canDelete: true, canEditName: true, type: 'section',
              root: { background: 'bg-[var(--ph-alternate-background)]' },
              mobile: { display: 'flex', flexDirection: 'flex-col', width: 'w-full', py: 'py-16', px: 'px-[var(--ph-container-padding-x)]' },
              desktop: { py: 'py-24' },
              custom: { displayName: 'Contact Section' } },
            displayName: 'Container', parent: 'page_home', nodes: ['contact_inner'], linkedNodes: {}
          },
          contact_inner: {
            type: { resolvedName: 'Container' }, isCanvas: true,
            props: { canDelete: true, canEditName: true, root: {},
              mobile: { display: 'flex', flexDirection: 'flex-col', gap: 'gap-12', width: 'w-full', maxWidth: 'max-w-[var(--ph-content-width)]', mx: 'mx-auto' },
              desktop: { flexDirection: 'flex-row', gap: 'gap-16' },
              custom: { displayName: 'Contact Inner' } },
            displayName: 'Container', parent: 'sec_contact', nodes: ['contact_info', 'contact_form_wrap'], linkedNodes: {}
          },
          contact_info: {
            type: { resolvedName: 'Container' }, isCanvas: true,
            props: { canDelete: true, canEditName: true, root: {},
              mobile: { display: 'flex', flexDirection: 'flex-col', gap: 'gap-6', width: 'w-full' },
              desktop: { width: 'w-1/2' },
              custom: { displayName: 'Contact Info' } },
            displayName: 'Container', parent: 'contact_inner', nodes: ['contact_title', 'contact_address', 'contact_hours_label', 'contact_hours_row1', 'contact_hours_row2', 'contact_hours_row3'], linkedNodes: {}
          },
          contact_title: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-primary)]', fontFamily: 'var(--ph-heading-font-family)' },
              mobile: { fontSize: 'text-3xl', fontWeight: 'font-bold' },
              desktop: { fontSize: 'text-4xl' }, text: 'Find us in {{company.location}}', tagName: 'h2',
              custom: { displayName: 'Title' } },
            displayName: 'Text', parent: 'contact_info', nodes: [], linkedNodes: {}
          },
          contact_address: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-alternate-text)]' },
              mobile: { fontSize: 'text-base', lineHeight: 'leading-relaxed' },
              desktop: {}, text: '{{company.address}}<br/>{{company.location}}<br/>{{company.phone}}', tagName: 'p',
              custom: { displayName: 'Address' } },
            displayName: 'Text', parent: 'contact_info', nodes: [], linkedNodes: {}
          },
          contact_hours_label: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-primary)]', fontFamily: 'var(--ph-heading-font-family)' },
              mobile: { fontSize: 'text-lg', fontWeight: 'font-bold', mt: 'mt-4' },
              desktop: {}, text: 'Opening hours', tagName: 'h3',
              custom: { displayName: 'Hours Label' } },
            displayName: 'Text', parent: 'contact_info', nodes: [], linkedNodes: {}
          },
          contact_hours_row1: {
            type: { resolvedName: 'Container' }, isCanvas: true,
            props: { canDelete: true, canEditName: true, root: {},
              mobile: { display: 'flex', flexDirection: 'flex-row', justifyContent: 'justify-between', width: 'w-full', py: 'py-2' },
              desktop: {},
              custom: { displayName: 'Hours Row' } },
            displayName: 'Container', parent: 'contact_info',
            nodes: ['contact_day1', 'contact_time1'], linkedNodes: {}
          },
          contact_day1: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-text)]' },
              mobile: { fontSize: 'text-sm', fontWeight: 'font-medium' },
              desktop: {}, text: 'Mon — Fri', tagName: 'p',
              custom: { displayName: 'Day' } },
            displayName: 'Text', parent: 'contact_hours_row1', nodes: [], linkedNodes: {}
          },
          contact_time1: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-alternate-text)]' },
              mobile: { fontSize: 'text-sm' },
              desktop: {}, text: '08:00 — 17:00', tagName: 'p',
              custom: { displayName: 'Time' } },
            displayName: 'Text', parent: 'contact_hours_row1', nodes: [], linkedNodes: {}
          },
          contact_hours_row2: {
            type: { resolvedName: 'Container' }, isCanvas: true,
            props: { canDelete: true, canEditName: true, root: {},
              mobile: { display: 'flex', flexDirection: 'flex-row', justifyContent: 'justify-between', width: 'w-full', py: 'py-2' },
              desktop: {},
              custom: { displayName: 'Hours Row' } },
            displayName: 'Container', parent: 'contact_info',
            nodes: ['contact_day2', 'contact_time2'], linkedNodes: {}
          },
          contact_day2: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-text)]' },
              mobile: { fontSize: 'text-sm', fontWeight: 'font-medium' },
              desktop: {}, text: 'Saturday', tagName: 'p',
              custom: { displayName: 'Day' } },
            displayName: 'Text', parent: 'contact_hours_row2', nodes: [], linkedNodes: {}
          },
          contact_time2: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-alternate-text)]' },
              mobile: { fontSize: 'text-sm' },
              desktop: {}, text: '10:00 — 16:00', tagName: 'p',
              custom: { displayName: 'Time' } },
            displayName: 'Text', parent: 'contact_hours_row2', nodes: [], linkedNodes: {}
          },
          contact_hours_row3: {
            type: { resolvedName: 'Container' }, isCanvas: true,
            props: { canDelete: true, canEditName: true, root: {},
              mobile: { display: 'flex', flexDirection: 'flex-row', justifyContent: 'justify-between', width: 'w-full', py: 'py-2' },
              desktop: {},
              custom: { displayName: 'Hours Row' } },
            displayName: 'Container', parent: 'contact_info',
            nodes: ['contact_day3', 'contact_time3'], linkedNodes: {}
          },
          contact_day3: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-text)]' },
              mobile: { fontSize: 'text-sm', fontWeight: 'font-medium' },
              desktop: {}, text: 'Sunday', tagName: 'p',
              custom: { displayName: 'Day' } },
            displayName: 'Text', parent: 'contact_hours_row3', nodes: [], linkedNodes: {}
          },
          contact_time3: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-alternate-text)]' },
              mobile: { fontSize: 'text-sm' },
              desktop: {}, text: 'Closed', tagName: 'p',
              custom: { displayName: 'Time' } },
            displayName: 'Text', parent: 'contact_hours_row3', nodes: [], linkedNodes: {}
          },
          contact_form_wrap: {
            type: { resolvedName: 'Container' }, isCanvas: true,
            props: { canDelete: true, canEditName: true,
              root: { background: 'bg-[var(--ph-background)]', radius: 'rounded-[var(--ph-border-radius)]', shadow: 'shadow-md' },
              mobile: { display: 'flex', flexDirection: 'flex-col', width: 'w-full', p: 'p-8' },
              desktop: { width: 'w-1/2', p: 'p-10' },
              custom: { displayName: 'Form Card' } },
            displayName: 'Container', parent: 'contact_inner', nodes: ['contact_form_title', 'contact_form'], linkedNodes: {}
          },
          contact_form_title: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-primary)]', fontFamily: 'var(--ph-heading-font-family)' },
              mobile: { fontSize: 'text-xl', fontWeight: 'font-bold', mb: 'mb-4' },
              desktop: {}, text: 'Send a message', tagName: 'h3',
              custom: { displayName: 'Form Title' } },
            displayName: 'Text', parent: 'contact_form_wrap', nodes: [], linkedNodes: {}
          },
          contact_form: {
            type: { resolvedName: 'Form' }, isCanvas: true,
            props: { canDelete: true, canEditName: true,
              formName: 'contact', root: {},
              mobile: { display: 'flex', flexDirection: 'flex-col', gap: 'gap-4', width: 'w-full' },
              desktop: {},
              custom: { displayName: 'Contact Form' } },
            displayName: 'Form', parent: 'contact_form_wrap', nodes: ['contact_field_name', 'contact_field_email', 'contact_field_msg', 'contact_submit'], linkedNodes: {}
          },
          contact_field_name: {
            type: { resolvedName: 'FormElement' }, isCanvas: false,
            props: { canDelete: true, canEditName: true, type: 'text', name: 'name', placeholder: 'Name', required: true,
              root: { border: 'border', borderWidth: 'border-[var(--ph-input-border-width)]', borderStyle: 'border-solid', borderColor: 'border-[color:var(--ph-input-border-color)]', radius: 'rounded-[var(--ph-input-border-radius)]', background: 'bg-[var(--ph-input-bg-color)]', color: 'text-[color:var(--ph-input-text-color)]' },
              mobile: { p: 'p-[var(--ph-input-padding)]', width: 'w-full' }, desktop: {},
              custom: { displayName: 'Name Field' } },
            displayName: 'FormElement', parent: 'contact_form', nodes: [], linkedNodes: {}
          },
          contact_field_email: {
            type: { resolvedName: 'FormElement' }, isCanvas: false,
            props: { canDelete: true, canEditName: true, type: 'email', name: 'email', placeholder: 'Email', required: true,
              root: { border: 'border', borderWidth: 'border-[var(--ph-input-border-width)]', borderStyle: 'border-solid', borderColor: 'border-[color:var(--ph-input-border-color)]', radius: 'rounded-[var(--ph-input-border-radius)]', background: 'bg-[var(--ph-input-bg-color)]', color: 'text-[color:var(--ph-input-text-color)]' },
              mobile: { p: 'p-[var(--ph-input-padding)]', width: 'w-full' }, desktop: {},
              custom: { displayName: 'Email Field' } },
            displayName: 'FormElement', parent: 'contact_form', nodes: [], linkedNodes: {}
          },
          contact_field_msg: {
            type: { resolvedName: 'FormElement' }, isCanvas: false,
            props: { canDelete: true, canEditName: true, type: 'textarea', name: 'message', placeholder: 'Your message', required: false,
              root: { border: 'border', borderWidth: 'border-[var(--ph-input-border-width)]', borderStyle: 'border-solid', borderColor: 'border-[color:var(--ph-input-border-color)]', radius: 'rounded-[var(--ph-input-border-radius)]', background: 'bg-[var(--ph-input-bg-color)]', color: 'text-[color:var(--ph-input-text-color)]' },
              mobile: { p: 'p-[var(--ph-input-padding)]', width: 'w-full' }, desktop: {},
              custom: { displayName: 'Message Field' } },
            displayName: 'FormElement', parent: 'contact_form', nodes: [], linkedNodes: {}
          },
          contact_submit: {
            type: { resolvedName: 'Button' }, isCanvas: false,
            props: { canDelete: true, canEditName: true, type: 'submit', text: 'Send',
              root: { background: 'bg-[var(--ph-primary)]', color: 'text-[var(--ph-primary-text)]', radius: 'rounded-[var(--ph-border-radius)]' },
              mobile: { width: 'w-full', py: 'py-3', fontWeight: 'font-bold', textAlign: 'text-center' },
              desktop: {},
              custom: { displayName: 'Submit Button' } },
            displayName: 'Button', parent: 'contact_form', nodes: [], linkedNodes: {}
          },
        },
      };

      patterns['quote-testimonials'] = {
        description: 'Testimonial cards in a 2-column grid. Each card has: star rating row, quote text, reviewer name + role. Cards have background, border, shadow, rounded corners. Section has eyebrow + heading.',
        usage: 'Change quote text, names, star count. Add/remove cards by adding nodes to grid.',
        nodes: {
          sec_testimonials: {
            type: { resolvedName: 'Container' }, isCanvas: true,
            props: { canDelete: true, canEditName: true, type: 'section',
              root: { background: 'bg-[var(--ph-background)]' },
              mobile: { display: 'flex', flexDirection: 'flex-col', alignItems: 'items-center', width: 'w-full', py: 'py-16', px: 'px-[var(--ph-container-padding-x)]', gap: 'gap-10' },
              desktop: { py: 'py-24' },
              custom: { displayName: 'Testimonials Section' } },
            displayName: 'Container', parent: 'page_home', nodes: ['test_header', 'test_grid'], linkedNodes: {}
          },
          test_header: {
            type: { resolvedName: 'Container' }, isCanvas: true,
            props: { canDelete: true, canEditName: true, root: {},
              mobile: { display: 'flex', flexDirection: 'flex-col', alignItems: 'items-center', gap: 'gap-2', width: 'w-full' },
              desktop: {},
              custom: { displayName: 'Header' } },
            displayName: 'Container', parent: 'sec_testimonials', nodes: ['test_eyebrow', 'test_title'], linkedNodes: {}
          },
          test_eyebrow: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-accent)]' },
              mobile: { fontSize: 'text-xs', fontWeight: 'font-bold', letterSpacing: 'tracking-widest', textAlign: 'text-center' },
              desktop: {}, text: 'HAPPY GUESTS', tagName: 'p',
              custom: { displayName: 'Eyebrow' } },
            displayName: 'Text', parent: 'test_header', nodes: [], linkedNodes: {}
          },
          test_title: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-primary)]', fontFamily: 'var(--ph-heading-font-family)' },
              mobile: { fontSize: 'text-3xl', fontWeight: 'font-bold', textAlign: 'text-center' },
              desktop: { fontSize: 'text-4xl' }, text: 'What customers say', tagName: 'h2',
              custom: { displayName: 'Title' } },
            displayName: 'Text', parent: 'test_header', nodes: [], linkedNodes: {}
          },
          test_grid: {
            type: { resolvedName: 'Container' }, isCanvas: true,
            props: { canDelete: true, canEditName: true, root: {},
              mobile: { display: 'grid', gridCols: 'grid-cols-1', gap: 'gap-6', width: 'w-full', maxWidth: 'max-w-4xl', mx: 'mx-auto' },
              desktop: { gridCols: 'grid-cols-2' },
              custom: { displayName: 'Grid' } },
            displayName: 'Container', parent: 'sec_testimonials', nodes: ['test_card1', 'test_card2'], linkedNodes: {}
          },
          test_card1: {
            type: { resolvedName: 'Container' }, isCanvas: true,
            props: { canDelete: true, canEditName: true,
              root: { background: 'bg-[var(--ph-background)]', radius: 'rounded-[var(--ph-border-radius)]', border: 'border', borderColor: 'border-[var(--ph-alternate-background)]', shadow: 'shadow-sm' },
              mobile: { display: 'flex', flexDirection: 'flex-col', gap: 'gap-4', p: 'p-6', width: 'w-full' },
              desktop: { p: 'p-8' },
              custom: { displayName: 'Quote Card' } },
            displayName: 'Container', parent: 'test_grid', nodes: ['test_stars1', 'test_quote1', 'test_author1'], linkedNodes: {}
          },
          test_stars1: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true, root: {},
              mobile: { fontSize: 'text-sm' }, desktop: {},
              text: '\u2605\u2605\u2605\u2605\u2605', tagName: 'p',
              custom: { displayName: 'Stars' } },
            displayName: 'Text', parent: 'test_card1', nodes: [], linkedNodes: {}
          },
          test_quote1: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-text)]' },
              mobile: { fontSize: 'text-sm', lineHeight: 'leading-relaxed' },
              desktop: {}, text: '"Exactly the kind of spot this neighborhood needed. The coffee is excellent, the vibe is calm, and they actually care about the music."', tagName: 'p',
              custom: { displayName: 'Quote' } },
            displayName: 'Text', parent: 'test_card1', nodes: [], linkedNodes: {}
          },
          test_author1: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-alternate-text)]' },
              mobile: { fontSize: 'text-xs', fontWeight: 'font-medium' },
              desktop: {}, text: 'Mara K. — Regular', tagName: 'p',
              custom: { displayName: 'Author' } },
            displayName: 'Text', parent: 'test_card1', nodes: [], linkedNodes: {}
          },
          test_card2: {
            type: { resolvedName: 'Container' }, isCanvas: true,
            props: { canDelete: true, canEditName: true,
              root: { background: 'bg-[var(--ph-background)]', radius: 'rounded-[var(--ph-border-radius)]', border: 'border', borderColor: 'border-[var(--ph-alternate-background)]', shadow: 'shadow-sm' },
              mobile: { display: 'flex', flexDirection: 'flex-col', gap: 'gap-4', p: 'p-6', width: 'w-full' },
              desktop: { p: 'p-8' },
              custom: { displayName: 'Quote Card' } },
            displayName: 'Container', parent: 'test_grid', nodes: ['test_stars2', 'test_quote2', 'test_author2'], linkedNodes: {}
          },
          test_stars2: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true, root: {},
              mobile: { fontSize: 'text-sm' }, desktop: {},
              text: '\u2605\u2605\u2605\u2605\u2605', tagName: 'p',
              custom: { displayName: 'Stars' } },
            displayName: 'Text', parent: 'test_card2', nodes: [], linkedNodes: {}
          },
          test_quote2: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-text)]' },
              mobile: { fontSize: 'text-sm', lineHeight: 'leading-relaxed' },
              desktop: {}, text: '"I bring work, order a cortado, and somehow finish a whole LP without checking my phone. The quiet hour here is real."', tagName: 'p',
              custom: { displayName: 'Quote' } },
            displayName: 'Text', parent: 'test_card2', nodes: [], linkedNodes: {}
          },
          test_author2: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-alternate-text)]' },
              mobile: { fontSize: 'text-xs', fontWeight: 'font-medium' },
              desktop: {}, text: 'Ellis P. — Weekday regular', tagName: 'p',
              custom: { displayName: 'Author' } },
            displayName: 'Text', parent: 'test_card2', nodes: [], linkedNodes: {}
          },
        },
      };

      patterns['offering-list'] = {
        description: 'Menu / offering list with items in rows. Each item has a title (left-aligned, bold) and description underneath. Optional dotted line separator between items. Good for "What we serve", services, or menu sections.',
        usage: 'Change item titles and descriptions. Add/remove items. Style with borders.',
        nodes: {
          sec_offerings: {
            type: { resolvedName: 'Container' }, isCanvas: true,
            props: { canDelete: true, canEditName: true, type: 'section',
              root: { background: 'bg-[var(--ph-background)]' },
              mobile: { display: 'flex', flexDirection: 'flex-col', width: 'w-full', py: 'py-16', px: 'px-[var(--ph-container-padding-x)]' },
              desktop: { py: 'py-24' },
              custom: { displayName: 'Offerings Section' } },
            displayName: 'Container', parent: 'page_home', nodes: ['offer_inner'], linkedNodes: {}
          },
          offer_inner: {
            type: { resolvedName: 'Container' }, isCanvas: true,
            props: { canDelete: true, canEditName: true, root: {},
              mobile: { display: 'flex', flexDirection: 'flex-col', gap: 'gap-8', width: 'w-full', maxWidth: 'max-w-3xl', mx: 'mx-auto' },
              desktop: {},
              custom: { displayName: 'Inner' } },
            displayName: 'Container', parent: 'sec_offerings', nodes: ['offer_title', 'offer_list'], linkedNodes: {}
          },
          offer_title: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-primary)]', fontFamily: 'var(--ph-heading-font-family)' },
              mobile: { fontSize: 'text-3xl', fontWeight: 'font-bold' },
              desktop: { fontSize: 'text-4xl' }, text: 'What we serve', tagName: 'h2',
              custom: { displayName: 'Title' } },
            displayName: 'Text', parent: 'offer_inner', nodes: [], linkedNodes: {}
          },
          offer_list: {
            type: { resolvedName: 'Container' }, isCanvas: true,
            props: { canDelete: true, canEditName: true, root: {},
              mobile: { display: 'flex', flexDirection: 'flex-col', width: 'w-full' },
              desktop: {},
              custom: { displayName: 'Items List' } },
            displayName: 'Container', parent: 'offer_inner', nodes: ['offer_item1', 'offer_item2', 'offer_item3'], linkedNodes: {}
          },
          offer_item1: {
            type: { resolvedName: 'Container' }, isCanvas: true,
            props: { canDelete: true, canEditName: true,
              root: { border: 'border-b', borderColor: 'border-[var(--ph-alternate-background)]' },
              mobile: { display: 'flex', flexDirection: 'flex-col', gap: 'gap-1', py: 'py-5', width: 'w-full' },
              desktop: {},
              custom: { displayName: 'Menu Item' } },
            displayName: 'Container', parent: 'offer_list', nodes: ['offer_name1', 'offer_desc1'], linkedNodes: {}
          },
          offer_name1: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-text)]' },
              mobile: { fontSize: 'text-base', fontWeight: 'font-semibold' },
              desktop: {}, text: 'The Grizzly', tagName: 'h3',
              custom: { displayName: 'Item Name' } },
            displayName: 'Text', parent: 'offer_item1', nodes: [], linkedNodes: {}
          },
          offer_desc1: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-alternate-text)]' },
              mobile: { fontSize: 'text-sm' },
              desktop: {}, text: 'Double-shot espresso with oat milk and cinnamon. Our house signature since day one.', tagName: 'p',
              custom: { displayName: 'Item Description' } },
            displayName: 'Text', parent: 'offer_item1', nodes: [], linkedNodes: {}
          },
          offer_item2: {
            type: { resolvedName: 'Container' }, isCanvas: true,
            props: { canDelete: true, canEditName: true,
              root: { border: 'border-b', borderColor: 'border-[var(--ph-alternate-background)]' },
              mobile: { display: 'flex', flexDirection: 'flex-col', gap: 'gap-1', py: 'py-5', width: 'w-full' },
              desktop: {},
              custom: { displayName: 'Menu Item' } },
            displayName: 'Container', parent: 'offer_list', nodes: ['offer_name2', 'offer_desc2'], linkedNodes: {}
          },
          offer_name2: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-text)]' },
              mobile: { fontSize: 'text-base', fontWeight: 'font-semibold' },
              desktop: {}, text: 'V60 Filter Coffee', tagName: 'h3',
              custom: { displayName: 'Item Name' } },
            displayName: 'Text', parent: 'offer_item2', nodes: [], linkedNodes: {}
          },
          offer_desc2: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-alternate-text)]' },
              mobile: { fontSize: 'text-sm' },
              desktop: {}, text: 'Hand-poured from a rotating roster of single-origin beans. Ask the barista what is on today.', tagName: 'p',
              custom: { displayName: 'Item Description' } },
            displayName: 'Text', parent: 'offer_item2', nodes: [], linkedNodes: {}
          },
          offer_item3: {
            type: { resolvedName: 'Container' }, isCanvas: true,
            props: { canDelete: true, canEditName: true,
              root: { border: 'border-b', borderColor: 'border-[var(--ph-alternate-background)]' },
              mobile: { display: 'flex', flexDirection: 'flex-col', gap: 'gap-1', py: 'py-5', width: 'w-full' },
              desktop: {},
              custom: { displayName: 'Menu Item' } },
            displayName: 'Container', parent: 'offer_list', nodes: ['offer_name3', 'offer_desc3'], linkedNodes: {}
          },
          offer_name3: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-text)]' },
              mobile: { fontSize: 'text-base', fontWeight: 'font-semibold' },
              desktop: {}, text: 'Matcha & Chai Latte', tagName: 'h3',
              custom: { displayName: 'Item Name' } },
            displayName: 'Text', parent: 'offer_item3', nodes: [], linkedNodes: {}
          },
          offer_desc3: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-alternate-text)]' },
              mobile: { fontSize: 'text-sm' },
              desktop: {}, text: 'Ceremonial-grade matcha or house-blended chai with your choice of milk.', tagName: 'p',
              custom: { displayName: 'Item Description' } },
            displayName: 'Text', parent: 'offer_item3', nodes: [], linkedNodes: {}
          },
        },
      };

      patterns['structured-footer'] = {
        description: 'Proper multi-row footer with dark background. Row 1: brand name + tagline. Row 2: address + phone as separate text nodes. Row 3: ButtonList with nav links (Privacy, Terms, etc). Row 4: copyright line. Each piece of content is its own node with independent styling — never crammed into one Text node.',
        usage: 'Change brand, address, links, copyright. Add social icon buttons. Adjust layout to multi-column on desktop if needed.',
        nodes: {
          sec_footer: {
            type: { resolvedName: 'Container' }, isCanvas: true,
            props: { canDelete: true, canEditName: true,
              root: { background: 'bg-[var(--ph-primary)]' },
              mobile: { display: 'flex', flexDirection: 'flex-col', alignItems: 'items-center', width: 'w-full', py: 'py-12', px: 'px-6', gap: 'gap-6' },
              desktop: { py: 'py-16' },
              custom: { displayName: 'Footer Section' } },
            displayName: 'Container', parent: 'ftr_content', nodes: ['ftr_brand', 'ftr_address', 'ftr_links', 'ftr_copy'], linkedNodes: {}
          },
          ftr_brand: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-primary-text)]', fontFamily: 'var(--ph-heading-font-family)' },
              mobile: { fontSize: 'text-lg', fontWeight: 'font-bold', textAlign: 'text-center' },
              desktop: {}, text: '{{company.name}}', tagName: 'h3',
              custom: { displayName: 'Brand' } },
            displayName: 'Text', parent: 'sec_footer', nodes: [], linkedNodes: {}
          },
          ftr_address: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-primary-text)]' },
              mobile: { fontSize: 'text-sm', textAlign: 'text-center' },
              desktop: {}, text: '{{company.address}} \u00b7 {{company.location}} \u00b7 {{company.phone}}', tagName: 'p',
              custom: { displayName: 'Address Line' } },
            displayName: 'Text', parent: 'sec_footer', nodes: [], linkedNodes: {}
          },
          ftr_links: {
            type: { resolvedName: 'ButtonList' }, isCanvas: true,
            props: { canDelete: true, canEditName: true, root: {},
              mobile: { display: 'flex', flexDirection: 'flex-row', gap: 'gap-4', justifyContent: 'justify-center', flexWrap: 'flex-wrap' },
              desktop: {},
              custom: { displayName: 'Footer Links' } },
            displayName: 'ButtonList', parent: 'sec_footer', nodes: ['ftr_link1', 'ftr_link2', 'ftr_link3'], linkedNodes: {}
          },
          ftr_link1: {
            type: { resolvedName: 'Button' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { background: 'bg-transparent', color: 'text-[var(--ph-primary-text)]' },
              mobile: { fontSize: 'text-sm', px: 'px-0', py: 'py-0' },
              desktop: {}, text: 'Privacy Policy', url: '/privacy',
              custom: { displayName: 'Link' } },
            displayName: 'Button', parent: 'ftr_links', nodes: [], linkedNodes: {}
          },
          ftr_link2: {
            type: { resolvedName: 'Button' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { background: 'bg-transparent', color: 'text-[var(--ph-primary-text)]' },
              mobile: { fontSize: 'text-sm', px: 'px-0', py: 'py-0' },
              desktop: {}, text: 'Terms of Service', url: '/terms',
              custom: { displayName: 'Link' } },
            displayName: 'Button', parent: 'ftr_links', nodes: [], linkedNodes: {}
          },
          ftr_link3: {
            type: { resolvedName: 'Button' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { background: 'bg-transparent', color: 'text-[var(--ph-primary-text)]' },
              mobile: { fontSize: 'text-sm', px: 'px-0', py: 'py-0' },
              desktop: {}, text: 'Contact', url: 'mailto:{{company.email}}',
              custom: { displayName: 'Link' } },
            displayName: 'Button', parent: 'ftr_links', nodes: [], linkedNodes: {}
          },
          ftr_copy: {
            type: { resolvedName: 'Text' }, isCanvas: false,
            props: { canDelete: true, canEditName: true,
              root: { color: 'text-[var(--ph-primary-text)]' },
              mobile: { fontSize: 'text-xs', textAlign: 'text-center' },
              desktop: {}, text: '\u00a9 {{year}} {{company.name}}. All rights reserved.', tagName: 'p',
              custom: { displayName: 'Copyright' } },
            displayName: 'Text', parent: 'sec_footer', nodes: [], linkedNodes: {}
          },
        },
      };

      // Return requested pattern or all
      if (args.pattern) {
        const p = patterns[args.pattern];
        if (!p) return { content: [{ type: 'text', text: `Unknown pattern: "${args.pattern}". Available: ${Object.keys(patterns).join(', ')}` }] };
        return { content: [{ type: 'text', text: `# Design Pattern: ${args.pattern}\n\n${p.description}\n\n**Usage:** ${p.usage}\n\n## Node Map\n\nPass this to add_custom_section(slug, sectionRootId: "${Object.keys(p.nodes)[0]}", nodes: <the nodes below>).\n\n\`\`\`json\n${JSON.stringify(p.nodes, null, 2)}\n\`\`\`` }] };
      }

      const summary = Object.entries(patterns).map(([k, v]) => `### ${k}\n${v.description}`).join('\n\n');
      return { content: [{ type: 'text', text: `# Design Patterns\n\nCall get_design_patterns(pattern: "name") to get the full node map for any pattern.\n\n${summary}` }] };
    }

    /* ── discovery: list_presets ── */
    if (name === 'list_presets') {
      const presetsPath = path.join(getProjectDir(), 'data/presets.json');
      if (!fs.existsSync(presetsPath)) {
        return { content: [{ type: 'text', text: 'No presets.json file found at data/presets.json.' }] };
      }
      const data = JSON.parse(fs.readFileSync(presetsPath, 'utf8'));
      let presets = data.presets || [];
      if (args.mood) {
        const m = args.mood.toLowerCase();
        presets = presets.filter(p => (p.mood || []).some(t => t.includes(m)));
      }
      const lines = presets.map(p => {
        const palettePreview = p.palette.slice(0, 6).map(c => `${c.name}: ${c.color}`).join(', ');
        return `### ${p.id}\n**${p.name}** — ${p.description}\nMoods: ${(p.mood || []).join(', ')}\nFonts: heading=${p.styleGuide?.headingFontFamily || '?'}, body=${p.styleGuide?.bodyFontFamily || '?'}\nPalette: ${palettePreview}\nRadius: ${p.styleGuide?.borderRadius || '?'} | Shadow: ${p.styleGuide?.shadowStyle || 'none'}`;
      });
      return {
        content: [{
          type: 'text',
          text: `# Theme Presets\n\nUse with set_theme(slug, preset: "preset-id"). Individual palette/fonts/styleGuide params override preset values.\n\n${lines.join('\n\n') || 'No presets match.'}`,
        }],
      };
    }

    /* ── remote: register ── */
    if (name === 'register') {
      const baseUrl = normalizeBaseUrl(config.apiBaseUrl) || 'https://pagehub.dev';
      const url = `${baseUrl}/api/v1/register`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: args.email, name: args.name }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || `Registration failed: ${resp.status}`);
      config.apiKey = data.apiKey;
      saveConfig(config);
      return {
        content: [{
          type: 'text',
          text: `Registered!\n  Email: ${data.email}\n  Name: ${data.name}\n  Subdomain: ${data.subdomain}\n  API Key: ${data.apiKey}\n\nAPI key auto-configured. You can now use list_templates, save_site, etc.`,
        }],
      };
    }

    /* ── remote: configure ── */
    if (name === 'configure') {
      config.apiKey = args.apiKey;
      if (args.apiBaseUrl) {
        const n = normalizeBaseUrl(args.apiBaseUrl);
        if (n) config.apiBaseUrl = n;
      }
      saveConfig(config);
      return { content: [{ type: 'text', text: `Configured. API key set, base URL: ${config.apiBaseUrl}` }] };
    }

    /* ── remote: list_templates ── */
    if (name === 'list_templates') {
      const data = await apiFetch('/api/v1/templates');
      const lines = (data.templates || []).map(t =>
        `• ${t.slug} — ${t.title}${t.hidden ? ' (hidden)' : ''}`
      );
      return { content: [{ type: 'text', text: lines.length ? lines.join('\n') : 'No templates found.' }] };
    }

    /* ── remote: pull_template ── */
    if (name === 'pull_template') {
      const { slug } = args;
      const data = await apiFetch(`/api/v1/templates/${encodeURIComponent(slug)}`);
      const decodedDir = path.join(getProjectDir(), 'data/examples/decoded');
      if (!fs.existsSync(decodedDir)) fs.mkdirSync(decodedDir, { recursive: true });
      const outPath = path.join(decodedDir, `${slug}.json`);
      fs.writeFileSync(outPath, JSON.stringify(data.content, null, 2) + '\n', 'utf8');
      return { content: [{ type: 'text', text: `Template "${slug}" pulled to ${outPath}` }] };
    }

    /* ── remote: list_sites ── */
    if (name === 'list_sites') {
      const data = await apiFetch('/api/v1/sites');
      const lines = (data.sites || []).map(s =>
        `• ${s._id} — ${s.name || '(unnamed)'}${s.domain ? ` [${s.domain}]` : ''} (updated ${s.updatedAt})`
      );
      return { content: [{ type: 'text', text: lines.length ? lines.join('\n') : 'No sites found.' }] };
    }

    /* ── remote: select_site ── */
    if (name === 'select_site') {
      const { id } = args;
      const data = await apiFetch(`/api/v1/sites/${encodeURIComponent(id)}`);
      config.activeSite = { id: data.id, name: data.name, draftId: data.draftId };
      saveConfig(config);
      return { content: [{ type: 'text', text: `Active site set to ${data.id} (${data.name || 'unnamed'})` }] };
    }

    /* ── remote: pull_site ── */
    if (name === 'pull_site') {
      const siteId = args.id || config.activeSite?.id;
      if (!siteId) throw new Error('No site id provided and no active site set. Run select_site first.');
      const data = await apiFetch(`/api/v1/sites/${encodeURIComponent(siteId)}`);
      if (!data.content) throw new Error('Site has no content.');
      const slug = data.name || data.draftId || siteId;
      const nodeCount = Object.keys(data.content).length;
      const writeLocal = args.writeLocal === true;
      if (writeLocal) {
        const decodedDir = path.join(getProjectDir(), 'data/examples/decoded');
        if (!fs.existsSync(decodedDir)) fs.mkdirSync(decodedDir, { recursive: true });
        const outPath = path.join(decodedDir, `${slug}.json`);
        fs.writeFileSync(outPath, JSON.stringify(data.content, null, 2) + '\n', 'utf8');
        return {
          content: [
            {
              type: 'text',
              text: `Site ${siteId} fetched (${nodeCount} nodes). Wrote repo mirror: ${outPath} (slug: ${slug}). For live edits still use patch_site_node, not hand-editing this file unless syncing examples.`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: `Site ${siteId} fetched from API (${nodeCount} nodes). No local file written. Edit this site with patch_site_node (per node) or save_site with inline content. Pass writeLocal: true only to mirror into data/examples/decoded for repo example workflows.`,
          },
        ],
      };
    }

    /* ── remote: save_site ── */
    if (name === 'save_site') {
      let content = parseMaybeJson(args.content);
      if (!content && args.slug) {
        const p = path.join(getDecodedExamplesDir(), `${args.slug}.json`);
        if (!fs.existsSync(p)) throw new Error(`No decoded file at ${p}`);
        content = JSON.parse(fs.readFileSync(p, 'utf8'));
      }
      if (!content) {
        throw new Error(
          'Provide content (inline JSON) for API sites, or slug only for committed repo examples under data/examples/decoded. Live sites: use patch_site_node for edits, or pull_site with writeLocal: true if you intentionally need a disk mirror.'
        );
      }

      const targetId = args.id || config.activeSite?.id;
      if (targetId) {
        const data = await apiFetch(`/api/v1/sites/${encodeURIComponent(targetId)}`, {
          method: 'PUT',
          body: {
            content,
            name: args.name,
            title: args.title,
            description: args.description,
          },
        });
        return {
          content: [{
            type: 'text',
            text: `Site ${data.id} updated. View: ${normalizeBaseUrl(config.apiBaseUrl) || 'https://pagehub.dev'}/build/${data.id}`,
          }],
        };
      }

      const data = await apiFetch('/api/v1/sites', {
        method: 'POST',
        body: {
          content,
          name: args.name,
          title: args.title,
          description: args.description,
        },
      });
      config.activeSite = { id: data.id, name: data.name, draftId: data.draftId };
      saveConfig(config);
      return {
        content: [{
          type: 'text',
          text: `New site created: ${data.id}\nEditor: ${data.url}\nPreview: ${data.staticUrl}`,
        }],
      };
    }

    /* ── remote: delete_site ── */
    if (name === 'delete_site') {
      const { id } = args;
      await apiFetch(`/api/v1/sites/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (config.activeSite?.id === id) {
        config.activeSite = null;
        saveConfig(config);
      }
      return { content: [{ type: 'text', text: `Site ${id} deleted.` }] };
    }

    /* ── remote: upload_image ── */
    if (name === 'upload_image') {
      const siteId = args.id || config.activeSite?.id;
      if (!siteId) throw new Error('No site id and no active site. Run select_site first.');
      if (!args.imageUrl && !args.dataBase64) {
        throw new Error('Provide imageUrl or dataBase64.');
      }
      const body = {
        ...(args.imageUrl ? { imageUrl: args.imageUrl } : {}),
        ...(args.dataBase64 ? { dataBase64: args.dataBase64 } : {}),
        ...(args.mimeType ? { mimeType: args.mimeType } : {}),
        ...(args.filename ? { filename: args.filename } : {}),
      };
      const data = await apiFetch(`/api/v1/sites/${encodeURIComponent(siteId)}/media`, {
        method: 'POST',
        body,
      });
      return {
        content: [{
          type: 'text',
          text: `Uploaded.\n  mediaId: ${data.mediaId}\n  type: cdn\n  url: ${data.url}\n\nUse in nodes: { "type": "cdn", "content": "${data.mediaId}" } (Image / background fields as in your template).`,
        }],
      };
    }

    /* ── remote: patch_site_node ── */
    if (name === 'patch_site_node') {
      const siteId = args.id || config.activeSite?.id;
      if (!siteId) throw new Error('No site id and no active site. Run select_site first.');
      const { nodeId, name: siteName, title, description, nodesPatch, unsetProps, unsetMobile, unsetRoot } = args;
      const data = await apiFetch(`/api/v1/sites/${encodeURIComponent(siteId)}`);
      if (!data.content || typeof data.content !== 'object') {
        throw new Error('Site has no decoded content (empty or corrupt).');
      }
      const flat = JSON.parse(JSON.stringify(data.content));
      applyNodePatches(flat, nodeId, normalizeNodePatchArgs({ ...args, nodesPatch, unsetProps, unsetMobile, unsetRoot }));
      const putBody = { content: flat };
      if (siteName !== undefined) putBody.name = siteName;
      if (title !== undefined) putBody.title = title;
      if (description !== undefined) putBody.description = description;
      const put = await apiFetch(`/api/v1/sites/${encodeURIComponent(siteId)}`, {
        method: 'PUT',
        body: putBody,
      });
      const base = normalizeBaseUrl(config.apiBaseUrl) || 'https://pagehub.dev';
      return {
        content: [{
          type: 'text',
          text: `Site ${put.id} updated (node ${nodeId}).\nEditor: ${base}/build/${put.id}`,
        }],
      };
    }

    /* ── remote: patch_site_bulk ── */
    if (name === 'patch_site_bulk') {
      const siteId = args.id || config.activeSite?.id;
      if (!siteId) throw new Error('No site id and no active site. Run select_site first.');
      let list = args.patches;
      if (typeof list === 'string') {
        list = parseMaybeJson(list);
      }
      if (!Array.isArray(list) || list.length === 0) {
        throw new Error('patches must be a non-empty array of { nodeId, ...patch fields }.');
      }
      const data = await apiFetch(`/api/v1/sites/${encodeURIComponent(siteId)}`);
      if (!data.content || typeof data.content !== 'object') {
        throw new Error('Site has no decoded content (empty or corrupt).');
      }
      const flat = JSON.parse(JSON.stringify(data.content));
      const touched = [];
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (!item || typeof item.nodeId !== 'string') {
          throw new Error(`patches[${i}]: missing nodeId`);
        }
        const { nodeId: nid, name: _ignore, title: _t, description: _d, id: _i, patches: _p, ...rest } = item;
        applyNodePatches(flat, nid, normalizeNodePatchArgs(rest));
        touched.push(nid);
      }
      const { name: siteName, title, description } = args;
      const putBody = { content: flat };
      if (siteName !== undefined) putBody.name = siteName;
      if (title !== undefined) putBody.title = title;
      if (description !== undefined) putBody.description = description;
      const put = await apiFetch(`/api/v1/sites/${encodeURIComponent(siteId)}`, {
        method: 'PUT',
        body: putBody,
      });
      const base = normalizeBaseUrl(config.apiBaseUrl) || 'https://pagehub.dev';
      return {
        content: [{
          type: 'text',
          text: `Site ${put.id} updated (${touched.length} nodes: ${touched.join(', ')}).\nEditor: ${base}/build/${put.id}`,
        }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: error.message }] };
  }
});

/* ────────────────────── start ────────────────────── */

async function run() {
  const transport = new StdioServerTransport();
  await MCP_SERVER.connect(transport);
  console.error('PageHub MCP Template Server v2 Connected.');
}

run().catch(console.error);
