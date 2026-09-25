# @pagehub/mcp

MCP server that lets AI assistants build, theme, and deploy complete websites on [PageHub](https://pagehub.dev).

Works with Claude Desktop, Cursor, VS Code, and any MCP-compatible client.

## Connect

This package isn't published to npm. Connect to the hosted server instead — there's nothing to install:

```json
{
  "mcpServers": {
    "PageHub": {
      "url": "https://pagehub.dev/api/mcp"
    }
  }
}
```

The first time you connect, your MCP client opens a browser so you can sign in to PageHub (or create an account). After that it stays signed in.

If your client can't do browser sign-in, send an API key as a header instead: `Authorization: Bearer ph_...`. Create a key at [pagehub.dev/dashboard/api-key](https://pagehub.dev/dashboard/api-key).

### Running it locally (PageHub contributors)

The stdio server in this folder depends on `@pagehub/mcp-core` through the PageHub monorepo workspace, so it only runs from inside that repo. Run `pnpm install` from the repo root, then point your client at it:

```json
{
  "mcpServers": {
    "PageHub": {
      "command": "node",
      "args": ["/path/to/pagehub.dev/packages/mcp/index.js"],
      "env": {
        "PAGEHUB_API_BASE_URL": "https://pagehub.dev",
        "PAGEHUB_API_KEY": "ph_your_key_here"
      }
    }
  }
}
```

It calls the same API as `/api/mcp`. Set `PAGEHUB_API_BASE_URL` to `http://localhost:3000` to use a local dev server. Needs Node.js 18+.

| Variable               | Required | Description                                                                         |
| ---------------------- | -------- | ----------------------------------------------------------------------------------- |
| `PAGEHUB_API_KEY`      | Yes      | API key from [pagehub.dev/dashboard/api-key](https://pagehub.dev/dashboard/api-key) |
| `PAGEHUB_API_BASE_URL` | No       | API base URL (default: `https://pagehub.dev`)                                       |

Settings come only from the `env` block of your MCP client config. Nothing is written to your project.

## Tools

### Discovery

| Tool                   | Description                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `list_blocks`          | Browse pre-built block templates with visual descriptions and overridable displayNames   |
| `get_component_schema` | CraftJS component types and props reference (Container, Text, Image, Button, Form, etc.) |
| `get_style_reference`  | Palette CSS variables, styleGuide tokens, layout prop keys, responsive patterns          |
| `list_presets`         | Curated theme presets by mood (see [Theme Presets](#theme-presets))                      |

### Site Building

| Tool               | Description                                                                            |
| ------------------ | -------------------------------------------------------------------------------------- |
| `set_theme`        | Configure palette, fonts, spacing, JSON-LD — supports loading a preset as base         |
| `insert_node`      | Add a new node to an existing parent (validates image URLs)                            |
| `delete_node`      | Remove a node and descendants (protects structural nodes)                              |
| `set_integrations` | Configure analytics/tracking (GA4, GTM, Search Console, Meta Pixel) — just pass the ID |
| `set_redirects`    | Configure 301/302 redirect rules for SEO (old path → new path)                         |
| `apply_kit_block`  | Add a library section block by slug to a page/header/footer                            |
| `add_nodes`        | Merge new nodes into a site efficiently                                                |

### Block Library

Use `search_blocks` + `apply_kit_block` for block composition. (Advanced block-library mutation tools are available on the full remote API surface.)

### Remote API

| Tool                               | Description                                                                                   |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| `list_templates` / `pull_template` | Browse and download stock templates from the API                                              |
| `list_sites` / `select_site`       | List tenant's sites and set active site context                                               |
| `delete_site`                      | Delete a site                                                                                 |
| `upload_image`                     | Upload to tenant CDN (validates MIME type)                                                    |
| `patch_site_node`                  | Edit a single node on a live site                                                             |
| `patch_site_bulk`                  | Apply multiple node patches atomically (race-condition safe — GET/PATCH/PUT in one operation) |

### Pages

| Tool          | Description                                                                            |
| ------------- | -------------------------------------------------------------------------------------- |
| `list_pages`  | List all pages in a site with flags (home, 404, hidden)                                |
| `add_page`    | Create a new page with SEO props and auto-positioning                                  |
| `update_page` | Update page name, home/404/hidden flags, SEO metadata, per-page head code / body class |
| `delete_page` | Remove a page and descendants (auto-promotes new home page)                            |

**Custom code (raw HTML / scripts / styles):** four scopes — pick the one whose reach matches what you're adding.

- **Analytics / pixels (GA4, GTM, Meta Pixel, Search Console):** use `set_integrations`. Always. Handles consent, de-dup, and load point.
- **Site-wide widget (every page — Intercom, Crisp, HubSpot, site-wide custom CSS):** `patch_site_node({ nodeId: "ROOT", propsPatch: { inject: { head: "<script>…</script>", footer: "<script>…</script>" } } })`. `inject.head` parses into `<head>` during SSR; `inject.footer` emits inline before `</body>`. Script tags execute at HTML-parse time.
- **Reusable block with its own widget (Cal.com popup, per-section Calendly):** add an `Embed` with `headCode` / `footCode`. Parsed and emitted the same way as `ROOT.props.inject.head`, but scoped to the block and deduped across blocks by content hash — the block ships its own init, no site-level setup. `runInEditor` defaults off so widget popups/boots don't fire during editing. Pair with a `Button` using `props.handlers.onClick` to invoke the loaded widget's API.
- **Per-page script (one landing page's A/B test, one product's schema.org JSON-LD):** `update_page({ pageId, headCode, bodyClass })`.
- **Inline iframe / Stripe Buy Button / static HTML at a spot:** `Embed` with `service: "custom"` and `code: "<iframe…>"`. ⚠️ Scripts inside `code` silently do not execute — put scripts in `headCode` / `footCode` instead.

**Custom 404 (`is404Page`):** Every plan can mark one page as the site’s not-found page. Unknown URLs render that page (with HTTP 404 on subdomains, `noindex` on ISR static).

### Blocks

| Tool               | Description                                                      |
| ------------------ | ---------------------------------------------------------------- |
| `search_blocks`    | Search the block library with filters (category, tags, source)   |
| `get_block`        | Get full block structure by slug                                 |
| `list_block_nodes` | List deterministic `lib_*` node ids for patching a library block |

### Portal

| Tool            | Description               |
| --------------- | ------------------------- |
| `set_portal`    | Enable a portal on a site |
| `get_portal`    | Get portal configuration  |
| `remove_portal` | Disable and remove portal |

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

`playwright-core` and `@axe-core/playwright` are optional dependencies of this package, so `pnpm install` from the monorepo root adds them. Contrast checks also need a browser: run `pnpm --filter @pagehub/mcp exec playwright-core install chromium` from the repo root.

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

**Hosted (`https://pagehub.dev/api/mcp`)** — OAuth 2.1. Your MCP client opens a browser, you sign in or create an account, and the client keeps the token.

**Local (stdio)** — Set `PAGEHUB_API_KEY` in the `env` block of your MCP client config. Create a key at [pagehub.dev/dashboard/api-key](https://pagehub.dev/dashboard/api-key).

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
