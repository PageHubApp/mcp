# @pagehub/mcp

MCP server that lets AI assistants build, theme, and deploy complete websites on [PageHub](https://pagehub.dev).

Works with Claude Desktop, Cursor, VS Code, and any MCP-compatible client.

## Quick Start

### Remote (Recommended)

Zero install. Add the URL to your MCP client config — authentication is handled via OAuth:

```json
{
  "mcpServers": {
    "PageHub": {
      "url": "https://pagehub.dev/api/mcp"
    }
  }
}
```

If your MCP client does not support OAuth, provide `Authorization: Bearer ph_...` manually.

### Local (stdio)

```json
{
  "mcpServers": {
    "PageHub": {
      "command": "npx",
      "args": ["-y", "@pagehub/mcp"],
      "env": {
        "PAGEHUB_API_BASE_URL": "https://pagehub.dev",
        "PAGEHUB_API_KEY": "ph_your_key_here"
      }
    }
  }
}
```

`stdio` is API-first by default (same remote-backed tool behavior as `/api/mcp`), so it works outside this repository.

Get your API key from [pagehub.dev/dashboard](https://pagehub.dev/dashboard). Override `PAGEHUB_API_BASE_URL` for a local dev server when needed.

### From Source

```bash
git clone https://github.com/PageHubJS/mcp.git
cd mcp
npm install
npm start
```

## Requirements

- **Node.js 18+** (stdio mode only)

## Configuration

| Variable               | Required | Description                                                         |
| ---------------------- | -------- | ------------------------------------------------------------------- |
| `PAGEHUB_API_KEY`      | Yes      | API key from [pagehub.dev/dashboard](https://pagehub.dev/dashboard) |
| `PAGEHUB_API_BASE_URL` | No       | API base URL (default: `https://pagehub.dev`)                       |

All configuration is passed via environment variables in the `env` block of your MCP client config. No config files are written to your project.

## Tools

### Discovery

| Tool                   | Description                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `list_blocks`          | Browse pre-built block templates with visual descriptions and overridable displayNames   |
| `get_component_schema` | CraftJS component types and props reference (Container, Text, Image, Button, Form, etc.) |
| `get_style_reference`  | Palette CSS variables, styleGuide tokens, layout prop keys, responsive patterns          |
| `list_presets`         | Curated theme presets by mood (see [Theme Presets](#theme-presets))                      |

### Site Building

| Tool               | Description                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| `set_theme`        | Configure palette, fonts, spacing, JSON-LD — supports loading a preset as base                      |
| `insert_node`      | Add a new node to an existing parent (validates image URLs)                                         |
| `delete_node`      | Remove a node and descendants (protects structural nodes)                                           |
| `set_integrations` | Configure analytics/tracking (GA4, GTM, Search Console, Meta Pixel) — just pass the ID              |
| `set_redirects`    | Configure 301/302 redirect rules for SEO (old path → new path)                                      |
| `apply_kit_block`  | Add a library section block by slug to a page/header/footer                                          |
| `add_nodes`        | Merge new nodes into a site efficiently                                                              |

### Block Library

Use `search_blocks` + `apply_kit_block` for block composition. (Advanced block-library mutation tools are available on the full remote API surface.)

### Remote API

| Tool                                      | Description                                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| `list_templates` / `pull_template`        | Browse and download stock templates from the API                                              |
| `list_sites` / `select_site`              | List tenant's sites and set active site context                                               |
| `delete_site`                             | Delete a site                                                                                  |
| `upload_image`                            | Upload to tenant CDN (validates MIME type)                                                    |
| `patch_site_node`                         | Edit a single node on a live site                                                             |
| `patch_site_bulk`                         | Apply multiple node patches atomically (race-condition safe — GET/PATCH/PUT in one operation) |

### Pages

| Tool          | Description                                                 |
| ------------- | ----------------------------------------------------------- |
| `list_pages`  | List all pages in a site with flags (home, 404, hidden)     |
| `add_page`    | Create a new page with SEO props and auto-positioning       |
| `update_page` | Update page name, home/404/hidden flags, SEO metadata, per-page head code / body class |
| `delete_page` | Remove a page and descendants (auto-promotes new home page) |

**Custom code (raw HTML / scripts / styles):** PageHub supports script/style injection at three scopes — no dedicated tool, use what already exists:
- **Site-wide** — `patch_site_node({ nodeId: "ROOT", propsPatch: { header: "<script>…</script>", footer: "<script>…</script>" } })`. `header` goes into every page's `<head>`; `footer` renders before `</body>`. Use for chat widgets, custom CSS, verification tags, third-party scripts.
- **Per page** — `update_page({ pageId, headCode, bodyClass })`. `headCode` is raw HTML scoped to that page's `<head>`; `bodyClass` adds class(es) to `<body>` on that page only.
- **Inline embed** — `apply_kit_block` / `add_nodes` with an `Embed` component whose `service: "custom"` and `code: "<iframe…>"` renders raw HTML at the component's position.
- **Analytics / pixels:** prefer `set_integrations` (GA4, GTM, Meta Pixel, Search Console) over raw tags — it handles consent and de-dup.

**Custom 404 (`is404Page`):** Paid plans can mark one page as the site’s not-found canvas; unknown URLs render that page (with HTTP 404 on subdomains, `noindex` on ISR static). Free accounts cannot persist `is404Page` — the editor hides the toggle, `/api/save` strips the flag from compressed content, and `PUT /api/v1/sites/:id` strips it from decoded JSON before save.

### Blocks

| Tool               | Description                                                              |
| ------------------ | ------------------------------------------------------------------------ |
| `search_blocks`    | Search the block library with filters (category, tags, source)           |
| `get_block`        | Get full block structure by slug                                         |
| `list_block_nodes` | List deterministic `lib_*` node ids for patching a library block         |

### Portal

| Tool            | Description               |
| --------------- | ------------------------- |
| `set_portal`    | Enable a portal on a site |
| `get_portal`    | Get portal configuration  |
| `remove_portal` | Disable and remove portal |

### AI

| Tool             | Description                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `generate_image` | Generate an image with AI, upload to CDN, and optionally apply to a node                                                      |
| `generate_copy`  | Generate or improve copy via the same `/api/ai/agent` path as the editor (`assistantScope: text`), not a separate improve API |

### Auditing

| Tool                  | Description                                                                 |
| --------------------- | --------------------------------------------------------------------------- |
| `audit_accessibility` | WCAG audit using axe-core (see [Accessibility Audit](#accessibility-audit)) |
| `audit_seo`           | SEO audit — meta tags, heading hierarchy, image alt text, content depth     |

## Key Features

### Theme Presets

Curated presets bundling palette (12 colors), Google Fonts, and styleGuide tokens (spacing, radius, input styling). Filter by mood keyword:

```
list_presets()              → all presets
list_presets(mood: "warm")  → warm-toned presets
list_presets(mood: "dark")  → dark-themed presets
```

Use a preset as a base in `set_theme`, then override individual values:

```
set_theme(preset: "warm-editorial", palette: [...overrides])
```

Every preset includes input styling tokens (`inputBorderColor`, `inputBorderRadius`, etc.) so forms render correctly out of the box.

### Design Patterns

Production-ready node structure recipes for layouts that pre-built templates don't cover:

| Pattern               | Description                                               |
| --------------------- | --------------------------------------------------------- |
| `bento-gallery`       | Asymmetric photo grid (2x2 with one tall image)           |
| `rich-contact`        | Hours + address + map + multi-field form                  |
| `quote-testimonials`  | Star ratings + quote cards in a grid                      |
| `offering-list`       | Menu/service list with title, description, optional price |
| `split-feature`       | Text left + image right (or reversed), with eyebrow label |
| `multi-column-footer` | 3-4 column footer with nav links, contact, social         |
| `horizontal-scroller` | Horizontal scroll strip of tags/categories                |

Each pattern returns a complete flat node map ready for `add_nodes`.

### Image Validation

`insert_node` validates image URLs before writing. A HEAD request is sent with an 8-second timeout. If any URL returns a non-200 status or times out, the operation is blocked with a detailed error listing each failed URL and its status.

This prevents broken images from being saved into templates.

### Concurrency Safety

File write operations (`delete_node`, `insert_node`) are serialized through a mutex to prevent concurrent writes from corrupting template JSON files. `patch_site_bulk` uses atomic GET/PATCH/PUT to prevent race conditions on live sites.

### Accessibility Audit

WCAG compliance auditing with two engines:

| Engine                    | When Used                                                       | Capabilities                                                                         |
| ------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Playwright + axe-core** | When `playwright-core` and `@axe-core/playwright` are installed | Full audit: contrast ratios, CSS evaluation, real browser rendering                  |
| **jsdom + axe-core**      | Fallback when Playwright unavailable                            | Structural audit only: heading hierarchy, form labels, ARIA — no contrast/CSS checks |

Supports WCAG levels A, AA (default), and AAA. Results are grouped by severity (critical, serious, moderate, minor) with HTML snippets and fix suggestions.

```bash
# For full audits including contrast checks, install Playwright:
npm install playwright-core @axe-core/playwright
npx playwright install chromium
```

### Site Integrations & Redirects

**Integrations** — analytics and site verification via simple ID fields, rendered as proper `<script>`/`<meta>` tags on published pages.

| Provider               | ID Format         | What it renders                          |
| ---------------------- | ----------------- | ---------------------------------------- |
| Google Analytics (GA4) | `G-XXXXXXXXXX`    | gtag.js + config script                  |
| Google Tag Manager     | `GTM-XXXXXXX`     | GTM container script                     |
| Google Search Console  | verification code | `<meta name="google-site-verification">` |
| Meta Pixel (Facebook)  | pixel ID          | fbevents.js + init/PageView              |

**Redirects** — server-side 301/302 redirect rules evaluated before page rendering.

```
set_redirects(redirects: [
  { from: "/old-page", to: "/new-page", permanent: true },
  { from: "/temp", to: "/promo", permanent: false }
])
```

### Authentication

**Remote** — OAuth 2.1. Your MCP client opens a browser, you sign in or register, token is stored automatically. Zero configuration.

**Local (stdio)** — Set `PAGEHUB_API_KEY` in the `env` block of your MCP client config. Get your key from [pagehub.dev/dashboard](https://pagehub.dev/dashboard).

No config files are written to your project.

## Agent Instructions

See [AGENT.md](./AGENT.md) for detailed tool usage rules and design guidelines.

### Working in the `pagehub.dev` monorepo (block library + fixtures)

The main app is a **pnpm** monorepo: install and run from the **repo root** (`pnpm install`, `pnpm run build`). See root **`README.md`**, **`.cursorrules`**, and **`CLAUDE.md`** for workspace rules (`pnpm-lock.yaml`, **`@pagehub/sdk`** deps, **`verify:vercel`**, CI).

Library blocks live in **`scripts/seed/data/blocks/*.block.json`** (single source of truth — metadata + structure in one file). They are not the live MCP library until synced to the database. Run **`node scripts/sync-repo-to-mongo.js`** (`--dry-run` / `--slugs=`) with **`MONGODB_URI`** to compare or push to Mongo. See **`BLOCKS-AI-CONTEXT.md`** for block building rules.

## Project Structure

```
index.js              Entry point (shebang)
src/
  server.js           MCP server setup and request routing
  config.js           Project detection, config persistence, API client
  helpers.js          Mutex, JSON parsing, image validation, node patching
  tools.js            Tool schema loading from mcp-core
  handlers/
    discovery.js      Schema, style reference, design patterns, presets
    remote.js         API tools (sites, templates, upload)
    pages.js          Page CRUD (list, add, update, delete)
    components.js     Block library (search, get, list nodes, patch, save, update, delete)
    portal.js         Portal configuration
    ai.js             AI image generation and copy writing
    accessibility.js  WCAG audit (Playwright + jsdom fallback)
    seo.js            SEO audit (meta, headings, images, content)
```

## License

MIT
