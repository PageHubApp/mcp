# PageHub MCP — Agent Rules

You are building websites through the PageHub MCP server. Your output must be **production-quality** — not wireframes, not "technically correct," but sites that look like they were designed by a professional. If a section looks generic or unfinished, you failed. Library blocks are references, not defaults: design each section for this business.

A PageHub site is **HTML + Liquid files** (`pages/*.liquid`, `partials/*.liquid`, `theme.css`, `site.json`). You read and edit files; the server lints, sanitizes, versions and stores every write.

## Quick Start

Before building anything, call these discovery tools:

1. **`get_style_reference`** — palette variables, spacing tokens, layout rules. Pass `topic` for a focused guide: `design`, `accessibility`, `domains`, `blocks`, `editing`, `theme`, `pages`, `site`, `media`, `integrations`, `animation`, and **`liquid`** (the tag, filter, object and lint reference, generated from the renderer so it is current, plus the runtime `data-*` attributes, site JavaScript, forms and form webhooks, dates and maps, each with an example). Tool descriptions stay short and point at these.
2. **`list_presets`** / **`suggest_palettes`** — curated themes by mood.
3. **`search_blocks`** / **`list_blocks`** / **`get_block`** — proven sections as Liquid. Two scopes: `blockType: "section"` (full page sections, default) and `blockType: "component"` (patterns that go inside sections: dropdowns, cards, accordions).
4. **`find_icon`** — resolves an icon ref instead of guessing.
5. **`list_site_files`** and **`read_site_file`** on a neighbouring page or partial — reuse the site's own classes and structure.

## Your edits are STAGED, not live

Every site write lands in the **draft**. The published site keeps serving its previous version until someone publishes.

- Edit freely on a live site — visitors do not see your work in progress.
- **`publish_site` is what makes it live.** It promotes the staged draft.
- Reads (`read_site_file`, `list_site_files`, `search_site_files`) return the **draft**, so you always see the latest work in progress — including unpublished edits made in the editor by a human.
- Ask before publishing someone's site unless they asked you to. The draft may contain their unfinished work as well as yours.

## Editing files

| Tool | What |
| --- | --- |
| `list_site_files` | Every draft path, and which page each file serves |
| `read_site_file` | Text plus its version (a content hash); `startLine` / `endLine` read a slice |
| `search_site_files` | Plain-text, case-insensitive line search (no regex), optional `path` prefix |
| `edit_site_file` | `edits: [{ oldText, newText, replaceAll? }]` applied to the text just read; `oldText` must match exactly once |
| `edit_site_files` | The same across several files as **one atomic write**: all land or none do. Use it when a change spans a partial and its pages |
| `write_site_file` | Create a file, or replace one with the `baseVersion` you read |
| `delete_site_file` | Non-page files (pages: `delete_page`) |

Rules:

1. Read before you edit; change the smallest span. Keep every `data-edit-*` attribute you did not mean to remove: they are the element ids history and review comments use.
2. Every write is checked. Lint errors come back as `line L:C [rule] message` and nothing is saved: fix that spot and write again. A version conflict means someone else saved: read again. In maintenance, writes are paused: tell the user and stop.
3. Liquid logic wraps WHOLE elements (no `{% if %}` inside a tag's attribute list). Close every element you open.
4. One writer per site. If a write keeps failing, report the exact error and stop; never rebuild a page to recover.
5. Site-wide third-party code (tracking, chat loaders) goes in `site.json` inject — never page content. Analytics ids: `set_integrations`.

Files: `pages/<slug>.liquid` (one per page; `pages/index.liquid` is home; `pages/shop/[handle].liquid` a detail page), `partials/<name>.liquid` (shared chrome, `{% render 'header' %}`), `sections/<name>.liquid` (reusable sections with a `{% schema %}`), `theme.css` (the design system as CSS custom properties), `site.json` (company, variables, `lang`, inject, SEO defaults, favicon, fonts; must stay valid JSON), `emails/<kind>.liquid`.

**Pages** are a record plus a file. `add_page` takes the page's `text`; `update_page` sets name, SEO, `pathPattern` and flags; per-page head code and body classes are edits to the file.

**Components** are partials: `list_components`, `rename_component` (rewrites every `{% render %}`), `delete_component` (refused while used).

**Bringing in a site the user already built** (plain HTML, or the output folder of a React/Vite/Next build): `import_site({ filePath: "./dist" })` — it zips the folder, uploads it and waits, then returns the new draft site's editor link. Don't rebuild it by hand. Recipe: https://pagehub.dev/skill.md

## Build Workflow

```
1. create_site({ template })                     → a site from a template (blank starter: "acme")
2. set_theme({ preset, … })                      → colors, fonts, spacing into theme.css
3. edit_site_file site.json                      → company name, phone, address, email, lang
4. header and footer partials                    → read partials/header.liquid, rewrite with edit_site_file
5. each page section                             → get_block / search_blocks for reference, then edit_site_file
6. update_page seo.title + seo.description       → on every page
7. set_integrations / set_redirects / set_favicon
8. audit_seo, audit_accessibility, screenshot_site → fix what they report; hand the user the previewUrl a tool returned (never build /view/… links: previews live on per-site hosts)
9. publish_site                                  → only when the user says so
```

**Starting from a library block:** `apply_kit_block({ id, slug, pageId?, before?, after?, position? })` places a copy in a page file with fresh ids, then you rewrite the copy for this business. A block is a starting point, not a link.

## Editing the library and templates (admin or tenant owner)

Blocks are Liquid snippets stored as `Component.source`. `save_block` creates one from `source`; `update_block` changes metadata or replaces `source`; `patch_block` makes exact-text `edits[]` to a block's Liquid (like `edit_site_file`); `delete_block` removes one.

A template is a bundle of files and page rows. `save_template` creates one from `files` (page rows derive from `pages/*.liquid`) or from a site's draft with `fromSite`; `update_template` merges `files`, applies exact-text `edits`, replaces `pages` or takes everything from `fromSite`; `publish_site_as_template` snapshots a site; `delete_template` removes one. Read a template with `pull_template`; audit it with `audit_seo` / `audit_accessibility` and `templateSlug`. Only an admin can make a template public.

## Custom Domains

Attaching a domain is two halves, and **you can only do the first one**. `set_domain` registers the domain on PageHub's Vercel project; the user then has to create DNS records at their registrar. Until they do, the site is not reachable on that domain no matter what PageHub reports.

```
1. check_domain(domain: "example.com")   → is it free? any conflict? what records?
2. set_domain(domain: "example.com")     → attach + get the records back
3. …user creates the DNS records…
4. get_domain_status()                   → "DNS live" once it has propagated
```

### Always hand over the records verbatim

`set_domain`, `check_domain`, and `get_domain_status` all return a **DNS records to create** block. Those values are **per-project** — Vercel issues targets like `d3adb33f.vercel-dns-017.com`, not the generic `cname.vercel-dns.com` you may have seen in older docs. Copy the returned rows out to the user exactly. Do not substitute a value you remember; a wrong target verifies never, and the failure looks identical to "DNS hasn't propagated yet".

### Apex vs subdomain — different record types

| Domain the user gave you | What gets attached | Records returned |
|---|---|---|
| `example.com` or `www.example.com` | **both** apex + www | `A` at `@` **and** `CNAME` at `www` |
| `ads.example.com` (any deeper subdomain) | that host only | one `CNAME` at `ads` |

An apex cannot be a CNAME — that is a DNS rule, not a PageHub one — which is why the apex gets an `A` record and every subdomain gets a `CNAME`. The `name` column in the returned rows is **zone-relative** (`@`, `www`, `ads`), which is what registrar UIs expect. If a variant is already correct, it simply produces no rows. A TXT row may also appear: that is Vercel's ownership challenge, returned when the domain is claimed by another Vercel account. It is *additional* to the routing record, not a replacement.

### apex ↔ www pairing

For a pair, `redirectMode` decides which half is canonical — `to-apex` (default, recommended) 308s `www` → apex, `to-www` does the reverse, `none` serves both (which splits SEO ranking signals — avoid). Change it later without touching the domain via `set_domain_redirect_mode`.

### Detaching and gotchas

`clear_domain()` detaches every variant from Vercel and resets the redirect mode. The DNS records at the registrar are the user's to remove; PageHub cannot touch their zone.

- **Plan-gated by count.** Custom domains are capped per account across all the owner's sites — Free allows 1. Attaching beyond the plan's limit returns a 403 with `upgrade: true`.
- **409 conflict** means a variant is already on another Vercel project. Nobody can fix that from here — the user detaches it in the Vercel dashboard, then you retry.
- **Certificates are async.** Right after DNS goes live, Vercel may still serve a cert error for a few minutes. That is normal; do not re-attach to "fix" it.
- **Publishing is separate.** A domain attaches to an unpublished site perfectly happily and serves nothing. Call `publish_site` too.

## Site Emails

The emails a site's visitors get — order receipt, order shipped, subscription welcome, gift cards, sign-in link, download delivery / update — are Liquid files the owner can design: `emails/<kind>.liquid`, with the subject and preview text in `emails/<kind>.json`. Tools: `list_site_emails`, `get_site_email`, `update_site_email`, `preview_site_email`.

- **Email-safe markup only.** No forms, buttons, media, dialogs, runtime attributes or page-only tags (errors). Unsupported classes are warnings. Layout becomes tables, so `flex-row` or `grid-cols-N` become columns that stack on phones.
- **Objects** are the kind's variables (`{{ customer.name }}`, `{{ order.total }}`), its parts (`order.lines`, `gift.code`, `link.url`, `download.files`, `version.notes`, `site.logo`), `company` and `year`. `get_site_email` lists them. A required part is required by the data it reads.
- Always `preview_site_email` after `update_site_email`: a design with errors sends the default instead, and the preview is where those errors show. `reset: true` goes back to the default.
- A custom design (`.liquid`) needs a plan with custom email designs; subject and preview text save on every plan.

## Presets and design patterns

Presets bundle palette colors, fonts and style tokens, and ship with input styling so forms render correctly.

```
1. list_presets(mood: "warm")                              → filter by mood keyword
2. set_theme(id, preset: "warm-editorial")                 → apply as base
3. set_theme(id, preset: "warm-editorial", palette: [...]) → apply + override specific colors
```

Mood filters: `warm`, `cool`, `dark`, `light`, `modern`, `classic`, `bold`, `minimal`, `restaurant`, `medical`, `creative`, `corporate`. A partial `set_theme` changes only what you pass; hand-written rules in `theme.css` are never touched.

For complex layouts (forms, accordions, galleries) read a block for how it is wired, then build the section for this business:

```
1. search_blocks({ q: "contact form" })   → find matching blocks
2. get_block({ slug: "contact-form" })    → study the Liquid
3. edit_site_file                         → write your own version
```

`search_blocks` auto-filters by the site's style so results stay visually cohesive; if nothing matches it widens to universal blocks. Trust it; don't re-query without the filter.

---

## Design Quality Rules

1. **Typography hierarchy.** Every section needs an eyebrow or a headline; four visible weight levels per page. Headings step down on mobile: `text-3xl sm:text-4xl md:text-6xl`, never a bare `text-6xl`. Exactly one h1 per page.
2. **Whitespace.** Section roots use spatial tokens (`py-space-lg`, scale `3xs 2xs xs sm md lg xl 2xl 3xl 4xl`; others compile to nothing), `px-container-x` on the section root and one inner `max-w-page mx-auto w-full`. No `py-16`, no `md:py-*`. A grid below a heading needs its own `mt-space-xl`.
3. **Cards** need padding + border + (shadow or background) — all three, or they read as unstyled divs.
4. **Images** need explicit width and height (or an aspect ratio) plus `object-cover`. Use `{{ '<mediaId>' | image_url: width: 800 | image_tag: alt: '…' }}` from `upload_image` (`image_tag` takes a URL: never a bare mediaId). Heroes tall, card images landscape.
5. **Buttons**: `btn btn-primary cta-responsive rounded-box px-space-md py-space-xs min-h-12 font-semibold`; outline: `btn btn-outline cta-outline-responsive rounded-box px-space-md py-space-xs min-h-12 font-semibold border-base-content/30 text-base-content`. `generate_button_classes` / `validate_button_classes` build and check them.
6. **Forms** are the most commonly broken element. Every input: `border border-base-300 bg-base-100 rounded-box px-space-sm py-space-xs`, a visible `<label>`, `autocomplete` on personal-data fields, and a background that differs from its card. Post with `{% form 'name' %}` and show `form.posted_successfully?` and `form.errors`.
7. **Icons**: `{{ 'tb/TbPhone' | icon }}` — Tabler (`tb`) for UI icons, `fa`/`si`/`bi`… for brands (`find_icon`). No emoji.
8. **Color**: palette tokens only (`bg-primary` with `text-primary-content`, `bg-base-100` with `text-base-content`); never `bg-black`, `text-white`, `bg-gray-*` or hex. Alternate section backgrounds; never 4+ in a row on the same one.
9. **Hero photos** use a child gradient overlay (`absolute inset-0 z-[1] bg-linear-to-b from-primary/90 via-primary/60 to-primary/85`), never a flat `bg-black/70`, and content at `relative z-10`.
10. **Chrome**: fixed or sticky headers `z-[1100]`, dialogs `z-[1200]`. A header with more than 2-3 links needs a mobile menu (a `popover` or `<dialog>` drawer). Header and footer always reserve a logo slot.
11. **The "does this look real?" test.** Would a business pay for this? If it looks like a Bootstrap demo, rebuild it.

### Accessibility — WCAG 2.1 AA (mandatory)

- Every image has `alt` (`""` and `aria-hidden="true"` if decorative). Sequential headings.
- Every form input has a `<label>`; icon-only buttons and links have an `aria-label`.
- 4.5:1 contrast on body text, 3:1 on large text; match text to its surface. Content colors in the palette ship only when they clear AA, otherwise the renderer swaps in a derived color (`set_theme` warns).
- Semantic elements: header, nav, main, section, footer. Reduced motion is automatic.
- Run `audit_accessibility` (static, on the rendered draft page) before you call a build done, and fix everything critical or serious.

## Interactive Features

Behaviour is native HTML or one `data-*` runtime attribute first. When the site needs its own JavaScript it may carry it, and nothing strips it. It runs on the preview and the live site, never in the editor canvas (check it with `screenshot_site` or the `previewUrl`). Library blocks and templates carry no JavaScript (it is stripped when they are saved), and PageHub AI inside the app never writes it; a site you build over MCP may.

```html
<!-- inline -->
<button type="button" onclick="document.getElementById('promo').remove()">Hide</button>

<!-- a section's or partial's own script: raw (no Liquid inside), added once per page before </body>, each block isolated -->
{% javascript %}
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
{% endjavascript %}

<!-- a file: write_site_file assets/app.js, then link it (the URL carries the content hash) -->
<script src="{{ 'app.js' | asset_url }}" defer></script>

<!-- declarative call into your script -->
<button data-on="click:openChat">Chat</button>
<script>
  window.PageHub = window.PageHub || { fns: {}, on: function (n, f) { this.fns[n] = f; } };
  PageHub.on("openChat", function (event, el) { /* … */ });
</script>
```

The editor's Scripts panel lists `assets/*.js`; "load on every page" adds a file to `partials/site-scripts.liquid`. Third-party vendor loaders still go in `site.json` inject.

- Modal: `<dialog id="book" closedby="any">` + `<button commandfor="book" command="show-modal">`. Menus, drawers, dropdowns: `popover` + `popovertarget`. Accordion: `<details name="faq">`. Tabs and toggles: radio inputs + `has-[:checked]:` / `peer-checked:` classes.
- **State is the URL.** Filters, sort, search and pagination are `?query` params read as `request.query.<name>`; a filter form is `<form method="get" data-autosubmit>`.
- Runtime attributes (full contracts and examples: `get_style_reference({ topic: "liquid" })`): `data-cart`, `data-autosubmit`, `data-animate`, `data-track`, `data-theme-toggle`, `data-copy`, `data-dismiss`, `data-scrollspy`, `data-autoplay`; `data-carousel="dots arrows wrap"` with your own `data-carousel-prev` / `-next` / `-dot`; `data-lightbox` (+ `-step`, `-grid`, `-caption`); `data-show-on="load|hover"`; `data-close-link`, `data-print`, `data-scroll-by`, `data-set-field`, `data-key-click`; `data-on` + `PageHub.on`; `data-state-*`; `data-refetch`.
- **Overlays from any element:** `commandfor` + `command` work on a non-button too (a gallery tile, a card): `<div commandfor="viewer" command="show-popover">`. An overlay that names itself closes only on a click on its own backdrop; an element with content inside the overlay it names (a drawer panel) never acts.
- **Carousel:** `<div data-carousel="dots arrows wrap" class="flex snap-x snap-mandatory overflow-x-auto">…slides…</div>` builds the controls; `wrap` loops past either end.
- **Dates:** `{{ post.date | date: '%B %d, %Y' }}`, `time_tag`, `{{ year }}` and `{{ site.timezone }}` use the site's timezone (`update_site` `timezone`); unset is UTC.
- **Animations**: `data-animate="<preset>"` (`fade-in`, `fade-up`, `fade-down`, `fade-left`, `fade-right`, `scale-up`, `blur-in`, `slide-up`, `flip-in`, `spring`, `bounce-in`, `thud-in`, `tile-flip`), `data-animate-trigger="load"`, `data-animate-stagger="80ms"` on the parent, `data-animate-exit`. A motion no preset covers: `@keyframes` and a class in `theme.css`, animating `transform`/`opacity`/`clip-path`, never layout properties.
- **Maps**: `{% map lat: 1, lng: 2, zoom: 12, tiles: 'osm' %}` with pin and route children. Use a route line when a business is hard to find (set back from the street, shared lot). Always `tiles: 'osm'`.
- **Detail pages**: `update_page` with `pathPattern` (`:slug` on page "Car" serves `/car/<slug>`); read the row with `request.params.<name>`.

## E-commerce — Stripe

Connect Stripe with `stripe_connect` (hand the owner the onboarding URL, call it again until `ready`). Once connected, the catalog syncs into the site's `products` collection on its own; `refresh_products` re-syncs on demand. `set_checkout` makes any collection sellable (a numeric `price` field in minor units, or a Stripe price id field).

**Building a shop:** start from `create_site({ template: "modern-store" })` or `"moss-and-fern"` when you can. Otherwise the parts are: a shop page looping `collections.products` with `request.query` for search, category, sort and page; a product page with `pathPattern: ":handle"`; the `cart-drawer` and `checkout-cancelled-banner` blocks in the footer partial; the `order-confirmed` block on its own page, with every checkout button's `data-cart-success` pointing at it; and the `customer-account` block at `/account`. Filter on product row fields (`categories`, `tags`, `subcategory`), never Stripe metadata. The full checklist is in `get_style_reference({ topic: "integrations" })`.

Store blocks: `connector-product-grid`, `connector-product-hero`, `connector-product-strip`, `storefront-product-detail`, `storefront-facet-filter`, `storefront-filter-sidebar`, `storefront-search-bar`, `storefront-pagination`, `storefront-promo-code`, `cart-drawer`, `cart-mini-bar`, `order-confirmed`, `checkout-cancelled-banner`, `storefront-navbar`, `customer-account`.

Data globals in Liquid: `collections.<slug>`, the Stripe catalog (`products`, `prices`), `customer` (`customer.signed_in`, `customer.me`, `customer.orders`), `company`, `year`. Site visitors sign in by magic link (separate from PageHub accounts); customer accounts need a paid plan. Never move money: no orders, refunds or price changes.

## Collections (per-site headless CMS)

A site can have typed collections (staff, FAQ, menu items, events, hours…). Loop one with `{% for item in collections.<slug> %}` and output `{{item.<fieldKey>}}`.

- `list_collections`, `get_collection(slug)` (schema, source, isPublic), `create_collection({ name, slug, schema, source?, isPublic? })` — `schema` is an array of `{ key, label, type, required?, formWritable?, ...typeConfig }`. `formWritable: false` means public forms can never write that field (enforced server-side).
- `update_collection_schema` (fields and member gates `requiredPlans`, `memberFields`), `delete_collection` (hard delete with all rows).
- Rows: `list_collection_rows`, `create_collection_row`, `update_collection_row`, `delete_collection_row`, `create_collection_rows` (up to 500, all-or-nothing), `import_collection_csv` (`mode: append|replace|upsert`, ~8 MB).
- `upload_file({ filePath?|fileUrl?|dataBase64?, mimeType?, filename? })` — images go to the CDN, video/audio/pdf/zip to R2. `filePath` (string or array) is the right input for anything on disk. Use `{{ '<mediaId>' | file_url }}` in markup.
- **Hosting a file for download** (game build, installer): `set_download({ name, filePath })` uploads privately and returns a stable link; a new build keeps the link (`downloadId`). `list_downloads`, `remove_download`. Pro+ for files; installers need Agency. Never put a download in `upload_file` without `private: true`.
- Forms write into a collection with `{% form 'name', map: 'fieldKey=inputName' %}` naming the collection; required fields with no input and no default make every submission 400, and `formWritable: false` fields are dropped.
- **Page access:** `update_page({ pageId, policy: { password?, access?, failAction?, redirectUrl?, fallbackPath?, bodyClass?, themeOverrides? } })` (`""` / `[]` clears a key); `list_pages({ pageId })` reads it back. A password or access rule is enforced on the published page, so `publish_site` after.
- **History:** `list_site_history` (versions, or `revisionId` for what changed, file by file) and `restore_site_revision` (into the draft only; a backup is taken first). **Client review comments:** `list_review_threads`, `reply_review_thread`. **Form inbox:** `list_form_submissions` (with each webhook's delivery status), `resend_form_webhook`, `list_form_webhooks`, `set_form_webhook_secret` (rotate shows the secret once). **Webhook-feed collection:** `set_collection_webhook`. `set_theme` also takes `typography` (type scale) and `breakpoints` (px).
- **Form webhooks:** `{% form 'leads', webhook: 'https://example.com/hooks/leads' %}` POSTs every submission as JSON (`event: "form_submission"`, `submissionId`, `site`, `formName`, `pagePath`, `submittedAt`, `data`, `attribution`), signed with `X-PageHub-Timestamp` and `X-PageHub-Signature: sha256=<hex HMAC-SHA256 of "<timestamp>.<raw body>">`. 5xx, 429 and network errors retry up to 6 attempts (1 min, 5 min, 30 min, 2 h, 12 h); other statuses fail without retry; receivers dedupe on `submissionId`. Each submission records its delivery (delivered, retrying, failed) and the owner can Resend it; the signing secret is set under the submissions screen's Webhook signing. The runtime also posts how the visitor arrived (`utm_*`, `gclid`, landing path, referrer) as the reserved `_ph_attribution` field, shown as `attribution`.

## Inspecting and Debugging

- `screenshot_site({ selector?, width?, path? })` — render the draft in a real browser and see what actually paints. Use it after every section, at the design's width and at 390; prefer `selector` over `fullPage` for below-the-fold content.
- `audit_seo`, `audit_accessibility` — the rendered draft page, scored.
- `get_style_reference({ topic })` — guides; `list_presets`, `list_blocks`, `list_components`.

## pagehub.dev monorepo (when you edit the repo, not only MCP over HTTP)

The main **pagehub.dev** codebase is a **pnpm** workspace: **`pnpm install`** and **`pnpm run build`** from the **repository root**; lockfile **`pnpm-lock.yaml`**. Authoritative rules for coding agents: repo root **`README.md`**, **`CLAUDE.md`**, and **`packages/mcp/README.md`**.
