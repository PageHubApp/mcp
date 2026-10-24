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

| Tool                  | Description                                                                         |
| --------------------- | ----------------------------------------------------------------------------------- |
| `list_blocks`         | Browse library blocks (Liquid snippets) with descriptions                           |
| `get_style_reference` | Palette CSS variables, styleGuide tokens, spacing, the HTML + Liquid format (`liquid`) |
| `list_presets`        | Curated theme presets by mood (see [Theme Presets](#theme-presets))                 |

### Site Building

A site is HTML + Liquid files. Edit them with the file tools; the server lints, sanitizes and versions every write.

| Tool                | Description                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `list_site_files`   | Every draft file, and which page each serves                                             |
| `read_site_file`    | A file's text and version (optionally a line range)                                      |
| `search_site_files` | Plain-text line search across files                                                      |
| `edit_site_file`    | Exact-text replacement in one file (`oldText` → `newText`)                               |
| `edit_site_files`   | Exact-text edits across several files as one atomic write                                |
| `write_site_file`   | Create a file, or replace one against the version you read                               |
| `delete_site_file`  | Remove a non-page file                                                                   |
| `set_theme`         | Palette, fonts, spacing into `theme.css` — supports loading a preset as base             |
| `set_integrations`  | Configure analytics/tracking (GA4, GTM, Search Console, Meta Pixel, Google Ads)          |
| `set_redirects`     | Configure 301/302 redirect rules for SEO (old path → new path)                           |
| `apply_kit_block`   | Place a library block (a copy, with fresh ids) into a page file                          |
| `list_components` / `rename_component` / `delete_component` | The site's partials: usage, rename (rewrites every `{% render %}`), delete |

### Block Library

Use `search_blocks` + `get_block` for reference and `apply_kit_block` to place one. Library authoring (admin or tenant owner): `save_block`, `update_block`, `patch_block` (exact-text edits to a block's Liquid), `delete_block`.

### Templates

`list_templates`, `pull_template` (a template's files; `path` for one). Authoring (admin or tenant owner/editor): `save_template` (from `files`, or a site's draft with `fromSite`), `update_template`, `publish_site_as_template`, `delete_template`.

### Remote API

| Tool                               | Description                                                       |
| ---------------------------------- | ----------------------------------------------------------------- |
| `list_sites` / `select_site`       | List tenant's sites and set active site context                   |
| `create_site` / `duplicate_site`   | Start a site from a template, or copy one                         |
| `publish_site` / `unpublish_site`  | Make the draft live, or take the site down                        |
| `delete_site`                      | Delete a site                                                     |
| `upload_image` / `upload_file`     | Upload to the CDN (images) or R2 (video, audio, pdf, zip)         |

### Pages

| Tool          | Description                                                                          |
| ------------- | ------------------------------------------------------------------------------------ |
| `list_pages`  | List all pages in a site with flags (home, 404, hidden)                              |
| `add_page`    | Create a page (its HTML + Liquid in `text`) with SEO props                           |
| `update_page` | Update page name, home/404/hidden flags, SEO metadata, `pathPattern`                 |
| `delete_page` | Remove a page and its file (auto-promotes a new home page)                           |

**Custom code (raw HTML / scripts / styles):** pick the scope whose reach matches what you're adding.

- **Analytics / pixels (GA4, GTM, Meta Pixel, Search Console):** use `set_integrations`. Always. Handles consent, de-dup, and load point.
- **Site-wide widget (every page — Intercom, Crisp, HubSpot, site-wide custom CSS):** `site.json` `inject` (`head` / `footer`) via `edit_site_file`. Third-party snippets only; hand-built bars, banners and popups are markup in a page or partial.
- **Per-page script (one landing page's A/B test, one product's JSON-LD):** a tag in that page file's `<head>`.
- **Inline iframe / widget at a spot:** the markup in the page file, with its `<script>` next to it (a site may carry JS; a vendor loader shared by every page goes in `site.json` inject).

**Custom 404 (`is404Page`):** Every plan can mark one page as the site's not-found page. Unknown URLs render that page.

### Blocks

| Tool            | Description                                                    |
| --------------- | -------------------------------------------------------------- |
| `search_blocks` | Search the block library with filters (category, tags, style)  |
| `get_block`     | Get a block's Liquid by slug                                   |

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

### Design patterns

Library blocks are copy-source examples (read one with `get_block`, then write the section for this business). Worth reading for how a behaviour is wired, all plain HTML + Liquid + `data-*` attributes:

| Block | Shows |
| --- | --- |
| `image-carousel` | `data-carousel` with `data-carousel-prev` / `-next` / `-dot` |
| `gallery-lightbox` | a photo grid with `data-lightbox` and a popover viewer |
| `cookie-consent` | `data-show-on="load"` gated by `data-show-if="!ls:seen"` |
| `mobile-call-bar` | a fixed bottom call bar |
| `modal-newsletter` | a `popover="manual"` opened on load (`data-show-on`) and closed with `commandfor` |
| `contact-map-hours` | hours + address + a `data-map` map + a form |
| `accordion-faq` | `<details name>` |

### Safe edits

`edit_site_file` and `edit_site_files` apply exact-text replacements to the text just read and write against that version, so an edit never silently overwrites someone else's change; `edit_site_files` saves several files as one atomic write.

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

Library blocks live in **`scripts/seed/data/blocks/<slug>.block.liquid`** (the markup) and **`<slug>.block.json`** (name, category, styles, tags). They are not the live MCP library until synced to the database. Run **`node scripts/sync-repo-to-mongo.js --blocks`** (`--dry-run` / `--slugs=`) with **`MONGODB_URI`** to compare or push to Mongo. Blocks and templates carry no JavaScript; see **`.claude/rules/templates.md`** and **`.claude/rules/block-template-sync.md`** for the rules.

## Project Structure

```
index.js              Entry point (shebang)
src/
  server.js           MCP server setup and request routing
  config.js           Project detection, config persistence, API client
  helpers.js          Mutex, JSON parsing, image validation
  tools.js            Tool schema loading from mcp-core
  handlers/
    remote.js         Delegates every API tool to @pagehub/mcp-core
    import.js         import_site from a local folder or .zip
    media.js          upload_image / upload_file / set_favicon from local files
    accessibility.js  WCAG audit (Playwright + jsdom fallback)
```

## License

MIT
