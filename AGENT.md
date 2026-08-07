# PageHub MCP — Agent Rules

You are building websites through the PageHub MCP server. Your output must be **production-quality** — not wireframes, not "technically correct," but sites that look like they were designed by a professional. If a block looks generic or unfinished, you failed. Build custom blocks rather than forcing pre-built templates that don't fit.

## Quick Start

Before building anything, call these discovery tools:

1. **`list_blocks`** — see pre-built block templates with visual descriptions
2. **`get_component_schema`** — learn component types and their props
3. **`get_style_reference`** — palette variables, layout props, styling rules
4. **`list_presets`** — curated theme presets by mood
5. **`search_blocks`** — find proven block patterns in the library; use with `apply_kit_block`. Two scopes: `blockType: "section"` (full page sections, default) and `blockType: "component"` (reusable patterns like dropdowns, cards, accordions that go inside sections)

## Your edits are STAGED, not live

Every site write lands in the **draft**. The published site keeps serving its previous version until someone publishes.

- Edit freely on a live site — visitors do not see your work in progress.
- **`publish_site` is what makes it live.** It promotes the staged draft.
- Write results say `Saved to DRAFT` and whether unpublished changes are outstanding. Do not report an edit as live until you have published.
- Reads (`get_site_node`, `list_site_nodes`, `search_site_nodes`) return the **draft**, so you always see the latest work in progress — including unpublished edits made in the editor by a human.
- Ask before publishing someone's site unless they asked you to. The draft may contain their unfinished work as well as yours.

## Live Editing Guardrails (Non-Negotiable)

Default to remote, surgical MCP edits. Do not rebuild full site JSON locally for routine work.

1. Use `apply_kit_block`, `patch_site_node`, `patch_site_bulk`, `add_nodes`, `delete_node`.
2. Prefer `patch_site_bulk` for multi-node edits (single atomic write, fewer race issues).
3. Treat `save_site` as exception-only (imports/migrations or explicit full rebuild requests).
4. Keep one writer per site/template at a time. Avoid concurrent structural writes.
5. Cap block discovery loops: run 1-2 targeted `search_blocks` calls, choose closest block, then patch.

### `add_nodes` Contract

1. `parentId` must be an existing node already present in the current site/template.
2. `rootNodeId` must exist in `nodes` and be the single top-level root of that payload.
3. If you need multiple roots, split into multiple `add_nodes` calls.
4. **Ignore "Parent ... does not exist in node map" warnings** when the parent IS an existing live node. The validator runs against the new-nodes map only, so it can't see the existing parent — the node still gets added correctly. Verify with `search_site_nodes` afterward if you need to confirm the attach.

### Structural Error Escalation

1. Retry with corrected IDs from `list_site_nodes` (lightweight tree, ~2KB) or `search_site_nodes(q, type)` and apply the smallest possible patch. Avoid `pull_site` (100KB+).
2. If the target is a standard layout (nav, hero, pricing, testimonials), switch to `search_blocks` + `apply_kit_block`.
3. If still blocked, report the exact MCP error and stop. Do not do a full-JSON reset as recovery.

### Editing blocks in the **library** (not on a site)

The live block catalog is API-backed. **Do not edit repo seed JSON** to change what users get from `search_blocks` / `apply_kit_block`.

**Preferred:** `list_block_nodes(slug)` to get **`lib_*`** ids, then **`patch_block`** or **`patch_block_bulk`** — patch fields: `propsPatch` (non-class props like text, src, alt, animation), `classNamePatch` (className string to merge/replace), `nodesPatch`, `unsetProps`, `unsetClasses`. Use **`get_block(slug)`** when you need the full tree in context.

**Fallback:** **`update_block`** for metadata-only, or a full **`structure`** replacement when a rewrite is truly whole-tree.

Full policy, layering rules, and icons: **`BLOCKS-AI-CONTEXT.md`** in the repo root.

## Build Workflow

```
1. create_template(slug)                          → scaffold empty template
2. set_theme(slug, preset, ...)                   → set colors, fonts, spacing
3. apply_kit_block(slug, target:"header")         → header nav from block library
4. apply_kit_block(slug) / add_custom_block       → (repeat for each page section)
5. apply_kit_block(slug, target:"footer")         → footer from block library
6. set_integrations(...)                          → GA4, GTM, Search Console, Meta Pixel
7. set_redirects(...)                             → 301/302 redirect rules
8. set_favicon(...)                               → browser-tab icon (mediaId / URL / SVG)
9. patch_site_node(slug, nodeId, ...)             → surgical tweaks
10. audit_accessibility(url/html)                 → check WCAG compliance
11. encode_all_templates()                        → finalize
```

### Using Presets

Presets are the fastest way to establish a professional design system. Each preset bundles 12 palette colors, Google Font families, and styleGuide tokens (spacing, radius, shadows, input styling).

```
1. list_presets()                     → browse all 18 presets
2. list_presets(mood: "warm")         → filter by mood keyword
3. set_theme(slug, preset: "warm-editorial")  → apply as base
4. set_theme(slug, preset: "warm-editorial", palette: [...])  → apply + override specific colors
```

Available mood filters: `warm`, `cool`, `dark`, `light`, `modern`, `classic`, `bold`, `minimal`, `restaurant`, `medical`, `creative`, `corporate`.

Every preset ships with input styling tokens, so forms render correctly without manual configuration.

### Using Design Patterns

Patterns provide battle-tested node structures for complex layouts. Always check patterns before building from scratch:

```
1. search_blocks(query: "contact form")            → find matching blocks
2. apply_kit_block(slug: "contact-form")           → apply to page
3. patch_site_node / patch_site_bulk               → customize content
```

**Reuse from this site (cheaper than the library).** `search_blocks` also surfaces existing sections on the current site under "Reusable from this site" when they're rich enough to adapt (≥5 descendants, ≥2 child component types). Clone instead of stamping a fresh library block by passing `sourceNodeId` instead of `slug`:

```
apply_kit_block({
  sourceNodeId: "sec_hero",           // from search_blocks site list
  sectionContainerId: "sec_hero_bottom",
  contentOverrides: { Heading: { text: "..." }, Description: { text: "..." } }
})
```

Pass EITHER `slug` OR `sourceNodeId` — never both. The cloned subtree gets fresh ids and is stamped with `custom.source = { type: "site-clone", fromNodeId }`. Headers/footers (target: "header"/"footer") still require a fresh library `slug`.

**Do NOT pass `style` or `preset` to `search_blocks`.** The server auto-injects the site's `buildStyle` (set by `set_theme`) as a hard filter so results stay visually cohesive with the rest of the page. If nothing matches, the server widens automatically to universal blocks — you'll see a `(Style widened: …)` note in the response. Trust it; don't re-query without the filter.

Styles are 6 aesthetic vibes (`aurora`, `brutalist`, `corporate`, `editorial`, `minimal`, `organic`) — many templates share a vibe, many blocks share a vibe. Canonical list: `packages/mcp-core/src/vibes.js`. Full architecture: repo path `.claude/known-issues/template-style-system.md`.

| Pattern               | When to use                                                   |
| --------------------- | ------------------------------------------------------------- |
| `bento-gallery`       | Photo-heavy sections needing visual variety (not a flat grid) |
| `rich-contact`        | Contact pages with hours, address, map, AND a form            |
| `quote-testimonials`  | Customer reviews with star ratings                            |
| `offering-list`       | Menus, service lists, pricing rows                            |
| `split-feature`       | Feature sections with text on one side, image on the other    |
| `multi-column-footer` | Rich footers with multiple link columns                       |
| `horizontal-scroller` | Tag strips, category filters, horizontal carousels            |

---

## Design Quality Rules

These rules are **as important as the technical rules**. Violating them produces ugly sites that technically render but look amateur.

### 1. Typography Hierarchy

Every page needs at least 4 levels of visual type weight. If all your text looks the same size, the page is flat.

| Level               | Use                                    | Example Styling                                                         |
| ------------------- | -------------------------------------- | ----------------------------------------------------------------------- |
| **Eyebrow / Label** | Section category, badge above headline | text-xs or text-sm, font-bold, tracking-widest, uppercase, accent color |
| **Headline**        | Section title, hero headline           | text-4xl to text-6xl, heading font family, font-bold, primary color     |
| **Subhead / Lead**  | Supporting paragraph under headline    | text-lg to text-xl, body font, normal weight, secondary/muted color     |
| **Body**            | Descriptions, card text, paragraphs    | text-sm to text-base, body font, normal weight, text color              |
| **Meta / Small**    | Dates, attribution, captions           | text-xs to text-sm, muted/alternate color                               |

**Rule:** Every section should have an eyebrow OR a headline. Sections with just body text look like placeholders.

### 2. Whitespace and Proportion

- **Section padding:** Use generous vertical padding. Desktop sections should have `py-20` to `py-32`, not `py-8`. Mobile can be `py-12` to `py-20`.
- **Content width:** Constrain content with `max-w-page` and `mx-auto`. Text blocks should be narrower: `max-w-3xl` or `max-w-2xl` for readability.
- **Gap hierarchy:** Gaps between sections > gaps between content blocks > gaps between elements. Example: section py=24, content gap=12, element gap=4.
- **Asymmetric spacing:** Not everything needs to be centered. Left-aligned text with right-side images creates visual tension. Use `items-start` and `text-left` on editorial sections.

### 3. Image Treatment

- **Always set height AND width** on images. `w-full` + `h-[400px]` or `h-[500px]` with `object-cover`. Never leave images to auto-size — they collapse or stretch.
- **Aspect ratios:** Hero images should be tall (h-[500px] to h-[600px] desktop). Card images should be landscape (h-48 to h-64). Gallery images should vary for visual interest.
- **Rounded corners:** Use tokenized radius on surfaces (`rounded-box`, `rounded-box`). Sharp-cornered images look unfinished unless the design is intentionally brutalist.
- **Image inside a rounded card or split frame:** Include both radius token and `overflow-hidden` in className on that Container when the image is full-bleed to an edge (e.g. `"rounded-box overflow-hidden"`).
- **Shadows on images:** `shadow-lg` or `shadow-2xl` on hero/feature images adds depth. Don't put shadows on every image.
- **Object fit:** Almost always `object-cover`. Only use `object-contain` for logos or icons.

### 4. Card Design

Cards (feature cards, testimonial cards, pricing cards) need these properties to not look flat:

```
className: "bg-base-200 text-base-content rounded-box border border-base-200 shadow-sm p-6 flex flex-col gap-3"
  borderColor: "border-base-200",
```

Split / full-bleed media: include both radius and `overflow-hidden` in className so the image clips (e.g. `"rounded-box overflow-hidden border shadow-sm"`).

**Rule:** Cards without padding, border, AND either shadow or background look like unstyled divs. Always apply all three.

### 5. Form & Button Styling

Forms are the most commonly broken element. Without explicit styling, they look like unstyled HTML from 1999.

**Buttons (especially submit):**

```
className: "bg-primary text-primary-content rounded-box w-full py-3.5 px-6 font-semibold text-sm text-center flex justify-center items-center md:w-fit"
```

**Rule:** Buttons MUST have: padding (py AND px), font-weight, border-radius, background + text color. A button without these looks broken. Submit buttons should be `w-full` inside forms.

**Form elements** get their styling from the theme's `styleGuide` input tokens. These MUST be set in `set_theme` — without them, inputs render as barely-visible browser defaults.

**Required input tokens in styleGuide:**

```json
{
  "border": "1px",
  "inputBorderColor": "#b8b0a0",
  "radiusField": "0.5rem",
  "inputPadding": "0.875rem 1rem",
  "inputBgColor": "#ffffff",
  "inputTextColor": "#1a1a1a",
  "inputPlaceholderColor": "#8a8a7a",
  "inputFocusRing": "2px",
  "inputFocusRingColor": "#2d4a3e"
}
```

**Key rule:** The `inputBorderColor` must be **visibly different** from the surrounding background. If your card background is `#f5f0e8` (cream), don't use `#e2e8f0` (light gray) — use something with real contrast like `#b8b0a0`. Test: can you SEE the border? If you have to squint, it's too subtle.

**FormElement nodes MUST include explicit styling in className.** CraftJS overrides component defaults when props are present in the JSON, so missing styling = unstyled inputs. Every FormElement MUST have:

```json
{
  "className": "border border-(--border) border-solid border-(--input-border-color) rounded-field bg-(--input-bg-color) text-(--input-text-color) p-(--input-padding) w-full"
}
```

**This is non-negotiable.** Include these classes on every FormElement node. The CSS variables pull values from the styleGuide tokens you set in `set_theme`.

**Form card wrapper:** Always wrap forms in a card container with:

- Background (`bg-base-100`)
- Padding (`p-8` to `p-10`)
- Border radius
- Shadow (`shadow-md`)
- Gap between fields (`gap-4` to `gap-5`)

### 6. Data Display (Hours, Prices, Stats)

Tabular data like hours, pricing rows, or stats need tight, consistent formatting:

- **Hours rows:** Use `flex-row` + `justify-between` with compact padding (`py-2` to `py-3`). Days should be `font-medium`, times should be muted color. Keep font size consistent (`text-sm`).
- **NO excessive vertical spacing** on data rows. `py-2` is enough. `py-6` makes hours look like they're floating in space.
- **Separator lines:** Use `border-b` + `border-(--card)` between rows for visual structure if needed — but don't overdo it. The reference site uses clean rows without heavy dividers.
- **Tabular alignment:** Times/prices should align right on mobile, left with min-width on desktop.

### 7. Icons — Use react-icons refs, NOT Emojis

PageHub ships every `react-icons` set as inline SVG. **Never use emoji characters** (☕, →, ▸, ★) as content — they render inconsistently across devices and look unprofessional.

**How icons work:**

- Icons are set on Button components via the `icon` prop.
- Every ref is inlined as SVG at SSR — no font, no FOUC, no client-side loader.
- Format: `icon: { value: "ref-icon:<set>/<ExportName>", position: "left", size: "w-7 h-7", gap: "gap-2" }`.
- `<set>` is any react-icons sub-package (`tb`, `fa6`, `fi`, `md`, `io5`, `hi2`, `lu`, `pi`, `si`, `ri`, `bi`, …).
- `<ExportName>` is the exact named export (case-sensitive, e.g. `TbMenu2`, `FaFacebook`, `SiSpotify`).
- **Prefer Tabler (`tb/*`)** for general UI icons. Use `fa`/`fa6`/`si`/`bi`/`bs`/`im`/`lia` for brand logos — **Tabler is NOT a complete brand registry**, so brands like Yelp / Airbnb / TikTok have no `TbBrand*` entry and render empty silently.
- **When unsure, call `find_icon`** — searches every set, returns ranked `ref-icon:<set>/<Name>` strings ready to paste. `find_icon({ q: "yelp" })` surfaces FaYelp/SiYelp/etc and tells you Tabler doesn't have it. `find_icon({ q: "phone" })` lands TbPhone first. Skips a round trip vs guessing.

**Common Tabler icons:**
| Name | Ref | Use for |
|------|-----|---------|
| menu | `ref-icon:tb/TbMenu2` | Hamburger menu |
| close | `ref-icon:tb/TbX` | Close button |
| phone | `ref-icon:tb/TbPhone` | Phone links |
| mail | `ref-icon:tb/TbMail` | Email links |
| map pin | `ref-icon:tb/TbMapPin` | Address / maps |
| star | `ref-icon:tb/TbStar` | Ratings |
| arrow right | `ref-icon:tb/TbArrowRight` | Navigation arrows |
| coffee | `ref-icon:tb/TbCoffee` | Cafe / drinks |
| clock | `ref-icon:tb/TbClock` | Hours / time |
| cart | `ref-icon:tb/TbShoppingCart` | Commerce |
| check | `ref-icon:tb/TbCircleCheck` | Checkmarks / success |
| chevron down | `ref-icon:tb/TbChevronDown` | Dropdowns |
| external link | `ref-icon:tb/TbExternalLink` | External links |

**Brand logos:** call `find_icon({ q: "<brand>", kind: "brand" })` — checks all 7 brand-heavy sets at once. Common pairings: `fa6/FaFacebook`, `fa6/FaInstagram`, `fa6/FaGithub`, `fa6/FaYoutube`, `fa6/FaTiktok`, `fa6/FaDiscord`, `fa6/FaSpotify`, `fa6/FaApple`, `fa6/FaGoogle`, `fa6/FaStripe`, `fa/FaYelp`, `si/SiAirbnb`, `bi/BiLogoSnapchat`. Tabler `TbBrand*` exists for some brands (Google, GitHub, X, Facebook, Instagram, LinkedIn, YouTube, WhatsApp) but **NOT** Yelp, Airbnb, TikTok — grep `tb.json` first or just call `find_icon`.

**Full catalogue:** Browse every exported name in the editor icon picker, or in the public react-icons gallery (https://react-icons.github.io/react-icons/).

**Icon-only buttons** (no text, just icon): set `icon.only: true`.

**Example — button with icon:**

```json
{
  "text": "Get Directions",
  "url": "#visit",
  "icon": {
    "value": "ref-icon:tb/TbMapPin",
    "position": "left",
    "size": "w-7 h-7",
    "gap": "gap-2"
  }
}
```

**CRITICAL: `ref-icon:*` ONLY works on Button `icon.value`.** Putting `ref-icon:tb/TbMapPin` as text content in a Text node renders the literal string, not an icon. For icon-only display, use a Button with `icon.only: true`.

**Where NOT to use icons (use Text instead):**

- Star ratings in testimonials — use `★` characters in a Text node (these are content, not UI icons)
- Decorative separators — use `·` or `—` in text
- Arrows in menu lists — these are presentational, a Text node with `→` is acceptable

### 8. Background Overlay (Image + Gradient)

To layer a gradient overlay on top of a background image (e.g. dark hero with readable text), use the `backgroundOverlay` prop on any Container. **Do NOT use `root.style` for this — the overlay prop handles it cleanly.**

**Preset strings (easiest):**

```json
{
  "background": { "image": "https://..." },
  "backgroundOverlay": "dark-left",
  "className": "bg-cover bg-center bg-no-repeat"
}
```

| Preset        | Effect                                |
| ------------- | ------------------------------------- |
| `dark-left`   | Dark gradient from left, fading right |
| `dark-right`  | Dark gradient from right, fading left |
| `dark-bottom` | Dark gradient from bottom, fading up  |
| `dark-top`    | Dark gradient from top, fading down   |
| `dark`        | Uniform dark overlay                  |
| `light`       | Uniform light overlay                 |

**Custom object (full control):**

```json
{
  "backgroundOverlay": {
    "direction": "to right",
    "from": { "color": "#0F1A2E", "opacity": 85 },
    "to": { "color": "#0F1A2E", "opacity": 20 }
  }
}
```

The renderer combines the overlay gradient and image into a single CSS `background-image: linear-gradient(...), url(...)` declaration — no conflicts, no `root.style` needed.

### 9. Image Validation

- **Use reliable image sources.** Unsplash URLs with `?w=600` or `?w=800` are reliable. Always include width parameter.
- **Never use placeholder URLs** like `via.placeholder.com` or broken CDN links.
- **Alt text is required** on every image. It should describe what's in the image, not be generic ("image 1").
- **Image type:** `"type": "cdn"` + a bare **mediaId** in `src` for anything in the media library or returned by `upload_image` — this unlocks responsive delivery (per-viewport srcset + `format=auto`). NEVER paste a full-size CDN delivery url (`imagedelivery.net/.../public`) as `type: "url"`. Use `"type": "url"` ONLY for external URLs you don't control (Unsplash, off-site). `sizes` and above-the-fold `eager`/priority are derived/stamped automatically — don't hand-set them.

**Automatic URL validation:** `add_custom_block` and `insert_node` send a HEAD request to every image URL before writing. The timeout is 8 seconds. If any URL fails (non-200 status or timeout), the entire operation is **blocked** — you'll get an error listing each bad URL and its status. Fix the URLs and retry.

**What's validated:**

- `Image` component `src` prop (when `type: "url"` or URL starts with `http`)
- `background.image` props on any node

**Not validated:** `add_block` does NOT validate image URLs passed via `contentOverrides`. If you need guaranteed validation, use `add_custom_block` instead.

### 8. Color Usage

- **Alternate section backgrounds:** Every 2nd or 3rd section should have `bg-base-200` to create visual rhythm. Don't make every section the same background.
- **Dark accent bands:** Use `bg-primary` with `text-primary-content` for CTA or statement sections. These break up the page and add drama.
- **Accent color sparingly:** Use `var(--accent)` for CTAs, badges, links, and small highlights — not large backgrounds (unless it's a CTA band).
- **Text color matching:** Body text on default bg uses `text-base-content`. Muted/supporting text uses `text-neutral-content`. Text on colored backgrounds MUST use the matching `-content` variable (e.g. `text-primary-content` on `bg-primary`).

### 9. Section Rhythm

A well-designed page alternates between:

- **Light section** (default background)
- **Tinted section** (alternate background)
- **Dark band** (primary/accent background)
- **Light section** (back to default)

Never have 4+ consecutive sections with the same background. The page looks like a Word document.

### 10. The "Does This Look Real?" Test

Before finishing, mentally check each section:

- Would a real business pay for this design? If it looks like a Bootstrap demo, rebuild it.
- Does every section have visual interest — an image, a card grid, a color band, or typographic variety?
- Are there at least 2 different section background colors used across the page?
- Would you scroll past any section without reading it because it's boring? Fix those.

### 11. Accessibility — Legal Compliance (WCAG 2.1 AA)

Sites MUST comply with WCAG 2.1 Level AA to avoid lawsuits under California's Unruh Act ($4,000+ per violation) and the EU European Accessibility Act. These are **mandatory**, not optional polish.

#### Images

- **Every `<Image>` MUST have `alt` text.** Decorative images get `alt: ""`. Content images get descriptive alt text.
- Never use images of text when actual text can achieve the same effect.

#### Headings & Structure

- Use proper heading hierarchy: `h1` → `h2` → `h3`. Never skip levels (e.g., `h1` → `h4`).
- Only ONE `h1` per page (typically the hero headline).
- Use semantic container types: `"header"`, `"nav"`, `"section"`, `"footer"`, `"main"`, `"aside"`.

#### Forms (Critical — Most Common Violation)

- **Every form input MUST have a `label` prop.** This renders a visible `<label>` element. Placeholder text is NOT a substitute for a label.
- Set `autocomplete` on personal data fields: `"name"`, `"email"`, `"tel"`, `"street-address"`, `"postal-code"`, `"organization"`.
- Mark required fields with `required: true`.
- Use descriptive `formName` on Form containers (used as `aria-label`).

#### Buttons, Links, Icons

- **`Button`** = filled / outlined / icon CTA (anything with `btn` chrome or visible button styling). Supports the full action surface (`link`, show-hide, open-modal, cart, toggle-theme, etc.).
- **`Link`** = plain text hyperlink. Always renders `<a>`, defaults to `link link-hover` (no button chrome). Use for inline "read more" / nav links / footer links / email + phone links. Only the navigational `link` action is allowed (any href: URL, `ref:<pageId>`, `#anchor`, `mailto:`, `tel:`). For interactive behavior (show-hide, modal, cart) use `Button`.
- **`Icon`** = standalone decorative or semantic icon. Renders `<span>` with inline SVG. No action, no text. Use for feature-tile icons, check bullets, hero badges. For an icon paired with text in a CTA or link, use the `icon` prop on `Button` / `Link` — do NOT place an `Icon` node next to a `Text` node when they form a single visual unit.
- Icon-only buttons MUST have text in the `text` prop (used as `aria-label` when `icon.only` is true). Same rule for `Link`.
- Standalone `Icon` nodes are decorative by default (`aria-hidden`). Pass `aria-label` only when the icon carries meaning on its own (status, warning, standalone indicator).
- Links to external URLs automatically get `rel="noopener noreferrer"` — no action needed.
- Link text must be descriptive. Never use "Click here" or "Read more" alone — include context: "Read more about our pricing".

#### Color Contrast

- Text on backgrounds must meet **4.5:1** contrast ratio (normal text) or **3:1** (large text 18px+).
- Don't convey information by color alone — add icons or text labels alongside color indicators.
- Use theme palette slots that have been designed for contrast: text on background, primary-text on primary, etc.

#### Navigation

- Every site gets a skip navigation link automatically (built into the renderer).
- Navigation menus use `<nav>` (Container type `"nav"`) — this is provided by the Container navbar presets.
- **Header blocks and MCP structures:** Prefer the **Container navbar presets** (not a lone Container of Buttons) for editable desktop links + hamburger + slide overlay. Match templates (`acme` header) and the library seed `navbar` (`scripts/seed/data/blocks/navbar.block.json`): `menu.id` must match the overlay `Container` `id` and hamburger `click.value`; duplicate link buttons inside the panel Container for static/view routes (omit `source` unless you have stable Craft node ids).

#### Motion & Animation

- The SDK respects `prefers-reduced-motion` automatically. No action needed, but don't rely on animation to convey essential information.

#### Automated Auditing with `audit_accessibility`

After building, run `audit_accessibility` to catch violations automatically. It uses axe-core and supports two engines:

- **Playwright** (full audit) — renders the page in a real Chromium browser, catches contrast ratio failures, CSS-dependent issues, and structural problems. Requires `playwright-core` + `@axe-core/playwright`.
- **jsdom** (fallback) — structural audit only. Catches heading hierarchy, missing labels, ARIA issues. Cannot check contrast or CSS. Used automatically when Playwright is unavailable.

```
audit_accessibility(url: "https://example.com")     → audit live site
audit_accessibility(html: "<html>...</html>")        → audit raw HTML
audit_accessibility(url: "...", level: "AAA")        → stricter AAA audit
```

Results are grouped by severity (critical → serious → moderate → minor) with HTML snippets and `helpUrl` links to fix guidance. Fix critical and serious violations first.

#### Checklist Before Finalizing

- [ ] All images have `alt` text
- [ ] Heading hierarchy is sequential (h1 → h2 → h3)
- [ ] All form inputs have `label` props
- [ ] Form inputs for personal data have `autocomplete`
- [ ] Icon-only buttons have `text` prop
- [ ] Color contrast is sufficient (dark text on light bg or vice versa)
- [ ] Semantic container types used (header, nav, section, footer)
- [ ] `audit_accessibility` returns 0 critical/serious violations

---

## Block Building — Pre-built vs Custom

### Decision Tree

For EVERY block, follow this process:

1. Call `list_blocks` — does a template **actually match** the layout?
   - Match the VISUAL DESCRIPTION, not just the name
   - "Kinda close" = NOT a match
2. Call `list_example_blocks` on decoded examples — similar block in an existing site?
   - YES → `extract_block` → adapt → `add_custom_block`
3. None of the above? Build from scratch with `add_custom_block` using the component schema

### The Golden Rule

**Default to `add_custom_block`.** Pre-built templates are shortcuts for common patterns. If the design has any complexity — split layouts, image grids, mixed content, forms with multiple fields — build it custom. It takes slightly longer but the output is 10x better than forcing a generic template.

### Anti-Patterns — NEVER DO THESE

| Anti-pattern                                         | Why it fails                                                 | Do this instead                                               |
| ---------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| Using `hero-2` for a split hero with image           | hero-2 is centered text only, min-h-screen = huge whitespace | Use `hero-3` or build custom                                  |
| Using `team-1` for testimonials                      | Team profiles ≠ review quotes                                | Use `testimonials-1` or build custom quote cards              |
| Using `optin-1` for contact form                     | Single email field ≠ multi-field form                        | Build custom with Form + multiple FormElements                |
| Using `texts-1` for anything complex                 | It's literally just a centered heading + paragraph           | Build custom                                                  |
| Forcing ANY pre-built template when it doesn't match | Generic output, broken proportions                           | Always build custom when no template fits                     |
| Making every block centered text                     | Page looks like a PowerPoint slide                           | Use split layouts, left-aligned text, asymmetric compositions |

---

## Interactive Features

### Animations (Preset System — No One-Offs)

All animations use the CSS Animation Preset system via `root.animation`. Users can customize duration, delay, and easing in the toolbar.

**Preset keys:**

| Category          | Keys                                                                                                                                                     | Best For                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Entrance (scroll) | `cssFadeIn`, `cssFadeUp`, `cssFadeDown`, `cssFadeLeft`, `cssFadeRight`, `cssScaleUp`, `cssBlurIn`, `cssSlideUp`, `cssFlipIn`, `cssSpring`, `cssBounceIn` | Cards, images, sections appearing on scroll |
| Hover             | `cssHoverGrow`, `cssHoverLift`, `cssHoverGlow`, `cssHoverPress`                                                                                          | Buttons, cards, interactive elements        |
| Continuous        | `cssSpin`, `cssPulse`, `cssWiggle`, `cssMarquee`, `cssMarqueeSlow`                                                                                       | Spinners, tickers, decorative               |
| Spotlight         | `cssChainSpotlight1/2/3`, `cssGridSpotlight1/2/3/4`                                                                                                      | Sequential card/tile highlights             |

**Example — cards that fade in on scroll:**

```json
{
  "className": "bg-base-200 text-base-content rounded-box border shadow-sm p-6",
  "root": {
    "animation": "cssFadeUp"
  }
}
```

**Usage:** Apply to 2-4 key sections for visual interest. Overusing animations makes the page feel gimmicky.

**DO NOT animate:** Headers, footers, hero sections (above the fold — already visible), or text-only blocks.

**NEVER** add custom `@keyframes`, `--animate-*` CSS vars, or `animate-*` classes in `className`. All animations must go through `root.animation` with a preset key. If a new animation pattern is needed, it must be added as a preset in `packages/sdk/src/utils/animations/animations.ts`.

### Tabs / Show-Hide Content Switching

Buttons can show, hide, toggle, or **tab-switch** other elements by DOM ID. The `tab` direction is purpose-built for tab interfaces — it hides all panels in a group, shows the target, and updates the active button state automatically.

**Click directions:**
| Direction | Behavior |
|-----------|----------|
| `tab` | Hides all elements in the group, shows the target, updates active button styling. **Use this for tabs.** |
| `show` | Makes the target element visible |
| `hide` | Hides the target element |
| `toggle` | Toggles visibility (used for mobile menus) |

**How to build tabs:**

1. Give each content panel a DOM `id` and a `tabGroup` prop (same group name):

```json
{
  "id": "panel-coffee",
  "tabGroup": "menu-tabs",
  "className": "flex flex-col gap-4"
}
```

2. Panels that start hidden use `hidden` in className:

```json
{
  "id": "panel-food",
  "tabGroup": "menu-tabs",
  "className": "hidden flex-col gap-4"
}
```

3. Tab buttons use `direction: "tab"` with the `group` matching the `tabGroup`:

```json
{
  "text": "Coffee & Drinks",
  "click": { "type": "click", "direction": "tab", "value": "panel-coffee", "group": "menu-tabs" }
}
```

**What `tab` does automatically:**

- Hides ALL elements with `data-tab-group="menu-tabs"`
- Shows the element with `id="panel-coffee"`
- Dims all sibling `data-tab-button` elements (opacity 0.6)
- Highlights the clicked button (opacity 1)

**Complete node structure for tabs:**

```
Container "Tab Buttons" (flex-row)
  ├── Button "Coffee" → click: { type: "click", direction: "tab", value: "panel-coffee", group: "menu-tabs" }
  │   (active by default — full opacity, filled background)
  └── Button "Food" → click: { type: "click", direction: "tab", value: "panel-food", group: "menu-tabs" }
      (inactive by default — reduced opacity, outlined/muted style)

Container "Panel Coffee" (id: "panel-coffee", tabGroup: "menu-tabs", display: flex) ← visible
  └── (coffee menu items)

Container "Panel Food" (id: "panel-food", tabGroup: "menu-tabs", display: hidden) ← starts hidden
  └── (food menu items)
```

**Key props:**

- Container: `id` (DOM id), `tabGroup` (renders as `data-tab-group`)
- Button: `click.direction: "tab"`, `click.value` (target panel id), `click.group` (must match `tabGroup`)

### Action Prop — Links, Navigation, and Interactivity

Text and Button components use the unified `action` prop for all link and interaction behavior. **Do not** use `<a>` tags in text HTML or legacy `url`/`click` props on new content.

**Action types supported on Text and Button:**

`link` collapses the 5 legacy navigation types — one `href` string encodes destination HTML-style.

| Type                | Props              | Use for                                                                                                                                                                                        |
| ------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `link`              | `href`, `target?`  | All navigation. `href` examples: `https://...` / `/relative` / `ref:<pageId>[/path]` / `#anchor` / `mailto:addr?subject=…&body=…` / `tel:+15551234`. `target` only honored for url/page hrefs. |
| `copy-to-clipboard` | `text`             | Copy text on click                                                                                                                                                                             |
| `download-file`     | `url`, `filename?` | File download trigger                                                                                                                                                                          |

**Button-only action types (not on Text):**

| Type            | Props                                     | Use for                                                                         |
| --------------- | ----------------------------------------- | ------------------------------------------------------------------------------- |
| `show-hide`     | `target`, `direction`, `method`, `group?` | Mobile menus, dropdowns, tabs, cookie consent dismiss                           |
| `open-modal`    | `anchor`                                  | Open a modal by ID                                                              |
| `add-to-cart`   | `quantity?` (default 1)                   | Add current data-bound item to cart (inside Stripe dataSource `Data` node only) |
| `toggle-cart`   | —                                         | Open/close the CartDrawer (on CartBadge or nav buttons)                         |
| `cart-checkout` | —                                         | Redirect to Stripe Checkout with cart contents                                  |

**Examples:**

```json
// External link on a Text heading
{ "text": "PageHub", "tagName": "h3", "action": { "type": "link", "href": "https://pagehub.dev", "target": "_blank" } }

// Internal page link
{ "text": "About", "action": { "type": "link", "href": "ref:page_about" } }

// Internal page with dynamic path (storefront PDP from a repeater item)
{ "text": "View product", "action": { "type": "link", "href": "ref:page_product/{{item.slug}}" } }

// Nav button scrolling to a section
{ "text": "Contact", "action": { "type": "link", "href": "#contact" } }

// Email button
{ "text": "hello@example.com", "action": { "type": "link", "href": "mailto:hello@example.com" } }

// Phone button
{ "text": "Call us", "action": { "type": "link", "href": "tel:+15551234567" } }

// Mobile menu toggle (default method: "class" — overlay starts with `hidden` class)
{ "text": "", "icon": { "value": "ref-icon:tb/TbMenu2" }, "action": { "type": "show-hide", "target": "mobile-nav", "direction": "toggle" } }
```

**Rules:**

- Always use `type: "link"` for navigation. Pick the right `href` shape — the prefix tells the browser/renderer everything.
- Mobile nav / modal overlays: `show-hide` with default `method: "class"`. Overlay Container starts with `hidden` in className (NOT `root.style: "display: none"`). The SDK's `showHideStore` keeps the toggle stable across React rerenders. ESC closes most-recently-shown overlay automatically.
- External links: set `target: "_blank"` (gets `rel="noopener noreferrer"` automatically).
- Legacy `link-url`, `link-page`, `scroll-to`, `email`, `phone` types still render correctly via a runtime shim, but DO NOT emit them in new content.

### Per-item detail page (collection / product PDP)

One page node that renders a **different** item based on a URL slug — car detail, product detail, blog post. Works for any first-party `collection`, not just the storefront `product`.

1. **Item needs a slug.** Add a `slug` text field to the collection (`update_collection_schema`) and set `data.slug` per row (e.g. `2019-porsche-911-gt3-rs`). It denormalizes into the query columns so the filter matches.
2. **Detail page.** `add_page({ name: "Car" })` → page node at `/car` (URL segment from displayName). Then `patch_site_node(page_car, { propsPatch: { pathPattern: ":slug" } })` so it serves `/car/:slug`.
3. **Bind by the URL param.** Inside the page, a `Data` node whose `dataSource` filters on the param:
   ```json
   { "provider": "collection", "collection": "listings", "filter": { "slug": "{{params.slug}}" }, "limit": 1 }
   ```
   `{{params.slug}}` is filled from the matched path tail. **All** detail content (title, gallery via a nested `Data` `scope: "item.photos"`, spec rows) lives INSIDE this `Data` node so `{{item.*}}` resolves.
4. **Link to it.** The list row / card fires `action: [{ "type": "link", "href": "ref:page_car/{{item.slug}}" }]`. `{{item.slug}}` interpolates per repeater item (works on `Container`, `Button`, `Link`); the renderer rewrites `ref:` → the real path.
5. **Optional/empty rows.** Gate each row that may be blank with an `item` `exists` condition (`conditionGroups`) — SSR-evaluated, so they show/hide correctly per item. (Client-reactive `state` gates fail-open on `item` conditions — don't use them for this.)
5b. **Empty / not-found state.** Add ONE child to the `Data` node flagged node-level `custom: { dataRole: "empty" }`. It renders in place of the rows ONLY when the binding definitively resolves to `[]` — an unknown detail slug, an empty collection, or a filter matching nothing — and never while still loading (a skeleton shows then). It renders once with NO item context (no `{{item.*}}`); design it as a "listing unavailable" / "nothing here yet" card (link back to the list). Whole-binding fallback — distinct from the per-row `item` `exists` gate above. `add_nodes` preserves node-level `custom.dataRole`.
6. **Move shared overlays to ROOT.** A detail-page CTA that opens the site's quote/contact modal — and the shared header's own CTA + hamburger — only work if the modal/drawer nodes are direct children of ROOT, not inside `page_home` (`move_node(<modalId>, ROOT)`). Otherwise they don't render on subpages and `show-hide` silently no-ops. Full authoring flow: [.claude/known-issues/multi-page-template-expansion.md](../../.claude/known-issues/multi-page-template-expansion.md).

### Known gotchas — patterns that need `ROOT.props.inject` workarounds

A few interactive patterns look like "just add a prop" but hit real SDK bugs or missing features. For marketing sites that depend on them (modals, mega menus, scroll-styled navs, text tickers), drop the documented inject payload into `ROOT.props.inject.head` + `inject.footer` rather than reinventing. Assemble **all needed workarounds into one inject payload** in a single `patch_site_node` call — splitting across patches loses whichever half gets overwritten.

| Pattern                                                                 | Bug / gap                                                                                                                                                                                                                                                    | Workaround doc                                                                                                                 |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Modal & drawer flex layout                                              | twMerge collapses `hidden` + `flex` (same display group). The visible-state layout (centered modal, column drawer) has to live in `:not(.hidden)` CSS. ESC + backdrop close are SDK-native — no JS inject needed                                             | [.claude/known-issues/modal-show-hide-gotchas.md](../../.claude/known-issues/modal-show-hide-gotchas.md)                       |
| Mega menu / dropdown hover gap                                          | `group-hover` breaks when panel is `fixed` far from trigger; cursor leaves `.group` element crossing the void                                                                                                                                                | [.claude/known-issues/dropdown-hover-gap-and-positioning.md](../../.claude/known-issues/dropdown-hover-gap-and-positioning.md) |
| Transparent fixed nav + scroll-to-glass                                 | No `scrollTrigger` primitive for toggling nav bg state or shrinking the logo on scroll                                                                                                                                                                       | [.claude/known-issues/transparent-fixed-nav-pattern.md](../../.claude/known-issues/transparent-fixed-nav-pattern.md)           |
| Text marquee seamless loop                                              | `cssMarquee` preset + `gap-X` utility = half-gap boundary mismatch on wrap (visible jump). Image marquees use the Container "Image Marquee" preset (`cssMarquee` animation + `[&>*]:mr-X` per-child margin); text tickers don't have an equivalent block yet | [.claude/known-issues/marquee-seamless-loop.md](../../.claude/known-issues/marquee-seamless-loop.md)                           |
| Body / html styling needs (sticky-CTA padding, body bg, html selectors) | `<body>` and `<html>` aren't Craft nodes — no `className` reaches them. Per-page: `update_page({ bodyClass })` (client-side only, fine for non-critical paint). Site-wide / first-paint: inline `<style>body{...}</style>` in `ROOT.props.inject.head`       | [.claude/known-issues/body-and-html-styling.md](../../.claude/known-issues/body-and-html-styling.md)                           |

Each doc includes copy-paste-ready inject CSS/JS, the required `className` / `attrs` tags on the affected nodes, and the "SDK TODO" note for the proper fix. Use these as reference when building contractor / services / marketing sites that need a real modal + mega menu + transparent-fixed nav combo.

---

## E-commerce — Stripe Cart System

PageHub supports live Stripe data display and shopping cart checkout. Users connect their Stripe account in Site Settings → Connectors.

**Human-readable reference (architecture, collections, bindings, variables, code map):** [`docs/stripe/README.md`](../../docs/stripe/README.md)

> **Shopify → Stripe product migration** is a separate dashboard feature (not MCP-callable). Site owners connect a Shopify Admin API token in `/dashboard/sites/[id]` → "Migrate from Shopify"; a Vercel-cron-driven background queue creates Stripe products + prices + maps Shopify metadata. See [`docs/stripe/SHOPIFY-IMPORT.md`](../../docs/stripe/SHOPIFY-IMPORT.md). Do not attempt to build / drive this from MCP — there are no tools for it, and direct Stripe writes would bypass the idempotency map.

### Components

| Component        | Where to place   | Purpose                                                                                                       |
| ---------------- | ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `CartDrawer`     | Site root (once) | Slide-out shopping cart. Children: header + footer. Cart items auto-render.                                   |
| `CartBadge`      | Navbar/header    | Cart icon wrapper with live item count. Use a child Button action `toggle-cart` (default preset includes it). |
| `CheckoutBanner` | Site root (once) | Post-checkout notification. Auto-shows after Stripe redirect.                                                 |
| `MapPoint`       | Child of `Map`   | A pin. `lat` / `lng` plus optional `title` / `description` for the popup.                                      |
| `MapPath`        | Child of `Map`   | A route line. `path` = `lat,lng` pairs, one per line, in travel order (2+ required).                          |

**`Map` accepts only `MapPoint` and `MapPath` children.** Reach for `MapPath` when a
business is hard to find — set back from the street, behind another building, in a
shared lot, unmarked driveway. Pair them: `MapPath` draws the way in, `MapPoint` marks
the destination. Options on `MapPath`: `label` (short caption drawn on the map,
centred halfway along the line with a halo so it survives busy tiles — "Enter here"),
`color` (default `var(--color-primary)`), `weight` (4), `opacity` (1), `dashed`
(true — dashes read as "follow this", a solid line reads as a boundary). `title` is
the accessible name only and is never drawn. It renders on all three paths — editor, viewer, and static
export — so it survives publishing. Prefer it over hand-drawing an SVG site map: the
route stays registered to real tiles at every zoom.

### Data-bound sections — use `Data`, not `Container`

`dataSource` lives on the **`Data`** component, not `Container`. `Data` is an extension of `Container` — same DOM output (one element, no extra wrapper), same layout/scroll/action behavior — but owns the repeater: connector resolution, scope/splitBy nesting, URL refetch, and per-item rendering. Use `Container` for plain layout; switch to `Data` the moment a section binds to a connector or repeats off a parent item (`scope`). When converting an existing node, `typePatch: "Data"` on `patch_site_node` / `patch_site_bulk` flips the component in place.

### Data-bound sections (Stripe collections — server-side)

Set `dataSource: { provider: "stripe", collection: "<name>" }` on a `Data` node. Children repeat per item.

Available collections: `products`, `prices`, `customers`, `orders`, `subscriptions`, `invoices`, `coupons`

Use `{{item.title}}`, `{{item.price.formatted}}`, `{{item.image}}`, etc. in child Text/Image/Button nodes. Variables also work in Button action URLs (e.g. `{{item.url}}`).

**Fallback syntax:** `{{item.description || "No description"}}` — shows fallback when field is empty/null. Works in Text, Button text, Image src, and Button action URLs. **Only one `||` is supported, and the fallback is a literal string — not a resolved variable.** `{{a || b || c}}` resolves to `a` or the literal text `"b || c"`. To fall back to another variable, use an `item` condition on the node (hide when the source field is missing) instead of chaining `||`.

**Array indexing:** the resolver splits paths on `.` only. Use dot-digit, not JS brackets: `{{item.images.1}}` works, `{{item.images[1]}}` does NOT (it fails silently and falls through to the `||` fallback). Same rule applies to `item` conditions — `key: "images.1"` with operator `exists` is the supported way to gate a node on "has a second image".

**Connector data shape (bindings):** Server and editor store Stripe (etc.) results per provider under `bindings[bindingId]` (not a single flat `products` key). Prefer `{{item.*}}` inside the bound `Data` node. For global interpolation (e.g. SEO) without repeater context, paths are `connector.<provider>.bindings.<bindingId>.<index>.<field>`. The editor variable picker lists real binding ids. Optional `dataSource.bindingKey` on the `Data` node keeps ids stable and readable when multiple sections share the same collection. Legacy `connector.<provider>.<collection>.0.*` paths are not supported.

### Data-bound sections (customer data — client-side)

Set `dataSource: { provider: "customer", collection: "<name>" }` on a `Data` node. Data is fetched client-side using the `ph-customer` cookie (magic link auth).

Available collections: `orders`, `me`

Customer orders use the same `{{item.title}}`, `{{item.price.formatted}}`, `{{item.metadata.created}}`, `{{item.description}}` variables as Stripe orders.

### Site customer auth system

Site visitors (not PageHub users) authenticate via magic link email. Separate from NextAuth.

- **Login**: Form block with `submissionType: "custom"`, action `/api/customer/magic-link`. Collects email, sends magic link. Site resolved from Host header.
- **Token detection**: `useCustomerToken` hook on all rendering routes. Detects `?token=` in URL, verifies via `/api/customer/verify`, sets `ph-customer` cookie, strips token from URL.
- **Customer data**: Blocks use `Data` nodes with `dataSource: { provider: "customer", collection: "orders" }` — fetched client-side with cookie auth.
- **Plan gating**: Free plan cannot use site customers. Pro: 500, Business: 10k, Agency: 100k max customers.

### Page access control

Pages (and any node) can use the `auth` condition type to show/hide based on login state.

- **Condition type**: `auth` — values: `logged-in` or `logged-out`. Available in the condition builder on any node or in Page Settings → Access tab.
- **Page Settings → Access tab**: Set conditions on a page + choose what happens when access is denied:
  - "Hide page content" (default)
  - "Redirect to URL" (e.g. `/login`)
  - "Show another page" (pick from site's pages)
- **Works on any node**: The `auth` condition works on containers, text, buttons — not just pages. Use it to show "Welcome back" content to logged-in customers or hide pricing from logged-out visitors.

### Storefront setup flow

1. User connects Stripe in Site Settings → Connectors (enters secret key)
2. Drop a storefront-navbar block (has CartBadge)
3. Drop a connector-product-grid block (data-bound to Stripe products)
4. Drop a cart-drawer block (CartDrawer with checkout button)
5. Drop a checkout-banner block (success/cancel feedback)
6. Stripe credentials are stored encrypted — NOT in `set_integrations` or ROOT.props

### Stripe blocks (category: "stripe")

Products: `connector-product-grid`, `connector-product-list`, `connector-product-hero`, `connector-product-strip`, `product-detail`
Prices: `connector-pricing-cards`
Customers: `connector-customer-list`
Orders: `connector-order-table`
Subscriptions: `connector-subscription-cards`
Invoices: `connector-invoice-table`
Coupons: `connector-coupon-grid`
Cart: `cart-drawer`, `cart-mini-bar`
Checkout: `checkout-banner`, `checkout-success`
Navigation: `storefront-navbar`
Site Customer Auth: `customer-login`, `customer-profile`, `customer-orders`

---

## Critical Technical Rules

### Colors — ALWAYS Use CSS Variables

```
✅ "bg-primary"     ❌ "bg-black"
✅ "text-primary-content"  ❌ "text-white"
✅ "border-base-200"  ❌ "border-gray-200"
```

Exception: `bg-transparent`, opacity modifiers (`bg-white/10`).

Match text to background: `bg-primary` → `text-primary-content`.

**Common mistakes:**

- **`text-neutral-content`** is ONLY valid on `bg-neutral`. On other surfaces use `text-base-content/70` for muted text.
- **`btn-primary` on dark themes:** if Primary ≈ Base 100 (both dark), the button is invisible. Use explicit `bg-* text-* px-* py-*` instead.
- **`max-w-content`** is Tailwind's native `max-width: max-content` (shrinks to content). NEVER use for layout containers. Use `max-w-page` (maps to `--content-width`, default 80rem).
- **Heading defaults:** Text nodes with tagName h1-h6 auto-receive `font-heading` + size + weight if className has no text-size class. Override by providing your own typography classes.
- **Font hierarchy: set once, use tokens.** Heading + Body fonts live in **`theme.typography[]`** as `Heading` and `Body` tokens (full `CustomFont` shape with `name`, `fontFamily`, `fontWeight`, `fontSize`, etc.). The SDK derives `--heading-font-family` / `--heading-font-weight` / `--body-font-family` / `--body-font-weight` from those tokens. Use `font-heading` / `font-body` on nodes — they resolve to `var(--heading-font-family)` etc. `accentFontFamily` (and any other `*FontFamily` key) still lives on `styleGuide` and auto-generates a CSS var; use `font-(--accent-font-family)` on nodes. When passing `styleGuide.headingFontFamily` / `bodyFontFamily` to `set_theme` for backward compat, the handler normalizes them into `Heading` / `Body` typography tokens automatically. **NEVER scatter `font-['Name']` across nodes.** NEVER put font-family in `root.style`. NEVER add Google Fonts `<link>` in `ROOT.props.header` — the system loads fonts automatically.

### Text Node Rules

- **One job per node.** Each Text node = one semantic block. Don't cram multiple paragraphs or headings into one node.
- **NEVER use `<a>` tags in text** — use the `action` prop on a Button instead.
- **richText.mode** (`full` | `inline`, default `full`): `full` = normal TipTap (blocks, lists, images). `inline` = inline-only editor — **saved `text` has no wrapping `<p>`**; use for one-line copy (cookie consent, labels). **Not tied to `tagName`** — set `inline` explicitly when you want that shape. Shape: `"richText": { "mode": "inline" }`. See `lib/schemas/Text.json`.
- **NEVER use `<p>`, `<div>`, `<h1>`-`<h6>` in text values for document semantics** — use the `tagName` prop instead. (`full` TipTap may still store one outer `<p>…</p>`; for `tagName: "p"` one-liners prefer `richText.mode: "inline"` or plain/inline-only `text`.)
- **Valid tagNames:** h1, h2, h3, h4, h5, h6, p, span, div.
- **Heading hierarchy:** h1 → h2 → h3, never skip levels, only ONE h1 per page.
- **Styling parts of text (split-color logos, highlighted words):** Use inline `style` with CSS variables: `<span style="color: var(--primary)">White</span><span style="color: var(--accent)">fall</span>`. NEVER use Tailwind classes inside text HTML (`<span class="text-primary">`) — the FOUC compiler does not scan `props.text`, only `props.className`.

### Auto-Validation (applied on save)

The system auto-fixes common issues when nodes are saved:

- **Missing tagName** on Text → inferred from className (large bold = h1, medium = h2, etc.)
- **Bare heading tags** (h1-h6 with no text-size class) → auto-receives `font-heading` + size + weight defaults
- **Bare text** not wrapped in HTML → auto-wrapped in `<p>` tags
- **Image `content` prop** → auto-migrated to `src` (legacy field)
- **Image missing `type`** → set `type: "url"` for external URLs, default `"cdn"` expects media library reference

### Palette Tokens (DaisyUI 5)

```
primary / primary-content
secondary / secondary-content
accent / accent-content
neutral / neutral-content
base-100 (page bg) / base-content (body text)
base-200 (cards/alt bg) / base-300 (borders/deeper)
error / error-content
info / info-content
success / success-content
warning / warning-content
border, input, ring
```

### Spacing — Spatial Token System

**5 fluid spacing tokens** (clamp-based, responsive by default — NO `md:py-*` or `md:gap-*` needed):
| Token | Range | Use for |
|-------|-------|---------|
| `--space-xs` | 6→8px | Micro gaps: icon-to-label, tag padding, banner/nav vertical padding |
| `--space-sm` | 12→16px | Element gaps: card items, form fields, button groups, card padding |
| `--space-md` | 24→32px | Content gaps: heading-to-grid, columns, footer/compact section padding |
| `--space-lg` | 40→64px | Section padding: standard block vertical padding |
| `--space-xl` | 56→96px | Statement padding: heroes, full-bleed CTAs |

**Two-step-minimum rule:** Section padding must be ≥ 2 tiers above inner gap. Inner gap `--space-sm` → section padding `--space-lg` or higher.

**NEVER hardcode** `py-16`, `gap-8`, `p-6` etc. — always use spatial tokens. NO responsive spacing prefixes (`md:py-*`, `md:gap-*`) — the clamp() tokens scale automatically.

```
ROOT → NO gap/padding/margin
  └─ page_home → NO gap/padding/margin
       └─ section → YES: py-space-lg px-container-x (or py-space-xl for heroes)
            └─ content → gap-space-sm, p-space-sm
                 └─ elements → sizing
```

### Responsive — Mobile First (className)

Every node uses a single `props.className` string with all Tailwind utilities. Mobile-first:

- Unprefixed classes = base styles (all sizes)
- `md:` prefix = 768px+ (desktop overrides)
- `lg:` prefix = 1024px+ (use for dense grids, split layouts that would be squeezed on tablet)

```json
{ "className": "flex flex-col grid-cols-1 md:flex-row md:grid-cols-3" }
```

```json
{ "className": "grid grid-cols-1 gap-4 lg:grid-cols-4" }
```

### Text Nodes — One Job Per Node

A Text node is for **one piece of content** — a heading, a paragraph, a caption, a copyright line. It is NOT a dumping ground for complex multi-line layouts.

**The Rule: If you need a `<br/>` to separate DIFFERENT types of content, you need SEPARATE NODES instead.**

| Wrong (one Text node)                                                         | Right (separate nodes)                                    |
| ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| `"123 Main St<br/>Los Angeles<br/>(555) 123-4567"`                            | 3 Text nodes: street, city, phone — each with own styling |
| `"© 2026 Acme · <a href='/privacy'>Privacy</a> · <a href='/terms'>Terms</a>"` | 1 Text node for copyright + Container of link Buttons     |
| `"Company Name<br/>Tagline<br/>Address"`                                      | Container with 3 child Text nodes                         |

**Why:** Each Text node can have its own `tagName`, `fontSize`, `fontWeight`, `color`. When you cram everything into one node, you lose all typographic control. The footer example above — copyright, address, and nav links all in one `<p>` — means you can't style the nav links differently from the address, can't change font sizes, can't adjust spacing between lines.

**Allowed inline formatting** (within a SINGLE text purpose):

- `<strong>`, `<em>` — bold/italic emphasis within a sentence
- `<span style="...">` — inline color/style within a sentence
- `<br/>` — ONLY for line breaks within the SAME content block (e.g. a multi-line address)

**NEVER in text values:**

- `<p>`, `<div>`, `<h1>`-`<h6>` for **semantics** — use `tagName` instead; use `richText.mode: "inline"` or inline-only HTML when you must avoid a redundant outer `<p>` in `text` while `tagName` is `p`
- `<a>` tags for navigation links — use Button components instead (they get proper hover states, click tracking, and accessibility)
- Multiple `<br/>` to create spacing — use separate nodes with margin/padding
- Complex HTML with classes — this bypasses the design system

**Footer example — right way:**

```
ftr_inner (Container, flex-col, gap-space-md, items-center)
  ├── ftr_brand (Text, "{{company.name}}", h3, font-bold, text-lg)
  ├── ftr_address (Text, "{{company.address}} · {{company.location}}", p, text-sm, muted)
  ├── ftr_links (Container, flex-row, gap-4)
  │     ├── Button "Privacy" → /privacy (link link-hover, text-sm)
  │     ├── Button "Terms" → /terms (link link-hover, text-sm)
  │     └── Button "{{company.phone}}" → tel:{{company.phone}} (link link-hover, text-sm)
  ├── ftr_divider (Container with border-t border-base-300 pt-space-sm)
  ├── ftr_social (Container, flex-row, gap-space-xs)
  │     └── Button icons (btn btn-ghost, icon-only)
  └── ftr_copyright (Text, "© {{year}} {{company.name}}", p, text-xs, muted)
```

**Footer conventions:**

- **Nav links:** use `link link-hover` classes (DaisyUI), not raw `bg-transparent border-0` button styles — gives underline-on-hover for free
- **Social icons:** use `btn btn-ghost` for hover/focus states
- **Dividers:** any `border-t` separator needs `pt-space-sm` for breathing room above the rule
- **Brand name:** `text-lg` (not `text-xl md:text-2xl`)
- **Body text / blurbs:** `text-sm` (not `text-sm md:text-base`)

**Link colors:** Footer links using `link link-hover` inherit text color from the parent surface. For dark backgrounds, add `text-neutral-content` or `text-primary-content`. For body links, the styleGuide `linkColor` and `linkHoverColor` tokens control `<a>` tag colors — set these in `set_theme` if the defaults don't match your palette.

### Special Characters — Always Use HTML Entities

Never use unicode escapes (`\u00a9`) or raw special characters in text content — they can fail to render across different contexts. Always use HTML entities:

| Character | Entity              | Use                        |
| --------- | ------------------- | -------------------------- |
| ©         | `&copy;`            | Copyright                  |
| —         | `&mdash;`           | Em dash                    |
| –         | `&ndash;`           | En dash                    |
| ·         | `&middot;`          | Middle dot separator       |
| →         | `&rarr;`            | Arrow (in text, not icons) |
| " "       | `&ldquo;` `&rdquo;` | Smart quotes               |
| ' '       | `&lsquo;` `&rsquo;` | Smart apostrophes          |
| &         | `&amp;`             | Ampersand (when literal)   |
| ™         | `&trade;`           | Trademark                  |
| ®         | `&reg;`             | Registered                 |

### Template Variables — Never Hardcode Business Info

| Variable               | Use            |
| ---------------------- | -------------- |
| `{{company.name}}`     | Business name  |
| `{{company.tagline}}`  | Tagline        |
| `{{company.location}}` | City, State    |
| `{{company.address}}`  | Street address |
| `{{company.phone}}`    | Phone          |
| `{{company.email}}`    | Email          |
| `{{year}}`             | Current year   |

### className Utilities Reference

All styling goes in a single `props.className` string. Common utilities:

| Category   | Examples                                                  |
| ---------- | --------------------------------------------------------- |
| Display    | `flex`, `grid`, `block`, `hidden`                         |
| Flex       | `flex-row`, `flex-col`, `items-center`, `justify-between` |
| Grid       | `grid-cols-1` to `grid-cols-12`                           |
| Gap        | `gap-4`, `gap-container`                                  |
| Width      | `w-full`, `w-1/2`, `w-[75%]`                              |
| Max width  | `max-w-page`, `max-w-3xl`                                 |
| Height     | `h-auto`, `h-[400px]`, `min-h-screen`                     |
| Padding    | `py-20`, `px-6`, `p-8`                                    |
| Margin     | `mx-auto`, `mt-4`                                         |
| Position   | `relative`, `absolute`, `z-10`                            |
| Overflow   | `overflow-hidden`, `overflow-auto`                        |
| Background | `bg-primary`, `bg-base-200`, `bg-transparent`             |
| Text color | `text-base-content`, `text-primary-content`               |
| Border     | `border`, `border-(--card)`, `border-2`                   |
| Radius     | `rounded-box`, `rounded-box`                              |
| Shadow     | `shadow-sm`, `shadow-md`, `shadow-lg`                     |
| Typography | `text-4xl`, `font-bold`, `leading-relaxed`                |

Desktop overrides use `md:` prefix: `md:flex-row md:gap-8 md:py-24`

### Node Structure (for add_custom_block)

```json
{
  "type": { "resolvedName": "Container" },
  "isCanvas": true,
  "props": {
    "canDelete": true,
    "canEditName": true,
    "type": "section",
    "className": "flex flex-col w-full py-16 px-6 bg-base-100 text-base-content md:py-24",
    "custom": { "displayName": "Section Name" }
  },
  "displayName": "Container",
  "parent": "page_home",
  "nodes": ["child_1", "child_2"],
  "linkedNodes": {}
}
```

---

## Design Analysis — Extracting & Transferring Design Techniques

When building from a reference site, you're not copying a design — you're extracting **techniques** and transferring them to a new context. The reference's identity (palette, copy, imagery, brand) gets replaced. The reference's techniques (how it creates visual interest) get kept.

### Step 1: Extract Design Techniques (the most important step)

Study the reference and extract **specific, reusable techniques** — not generic descriptions. "It has a hero section" is useless. "The hero uses a full-bleed background image with a linear-gradient overlay from rgba(0,0,0,0.6) to transparent, text pinned bottom-left, and a pill-shaped CTA with arrow icon" — that's a technique you can transfer.

**Extract these categories:**

#### Micro-design elements (the details that separate "designed" from "wireframe")

| Element            | What to look for                                          | Example extraction                                                              |
| ------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Eyebrow badges** | Pill shape? Colored dot prefix? Background fill? Border?  | "Rounded-full pill, bg-gray-100, text-xs tracking-widest, gold dot before text" |
| **Buttons**        | Shape, fill, icon, hover effect                           | "Dark pill buttons with arrow_forward icon right, text-swap on hover"           |
| **Dividers**       | Vertical between stats? Accent underlines? Border widths? | "1px vertical divider between stat blocks, border-neutral/30 opacity"           |
| **Stat numbers**   | Oversized with suffix? Colored? Font contrast?            | "Giant 72px heading-font number + smaller 24px 'Y+' suffix inline"              |
| **Section labels** | Just text? In a badge? With icon/dot?                     | "Pill badge with colored dot + uppercase text, not plain uppercase"             |

#### Typography tricks

| Trick              | What to look for                                                                  |
| ------------------ | --------------------------------------------------------------------------------- |
| **Fading text**    | Last line of a paragraph in muted/lighter color — draws reader in then trails off |
| **Size contrast**  | Massive stat numbers vs tiny labels. Large serif heading vs small sans body       |
| **Mixed families** | Serif headings + sans body creates instant sophistication                         |
| **Weight play**    | Thin body text (300) vs black headings (900) within same family                   |

#### Layout structures (copy these 1:1 — they're patterns, not identity)

| Pattern            | What to look for                                                                   |
| ------------------ | ---------------------------------------------------------------------------------- |
| **Nav**            | Logo position, separator line, link arrangement, right-side CTA button styling     |
| **Hero**           | Full-bleed image + overlay? Split layout? Centered text-only? What's the gradient? |
| **Split sections** | Column ratio, vertical alignment, what goes on each side                           |
| **Card grids**     | Column count, card styling (border vs shadow vs bg), internal layout               |
| **Form cards**     | Shadow, border-radius, header text, subtitle, response-time note, input styling    |
| **Footer**         | Column count, link grouping, dark/light, social icon placement                     |

#### Visual depth (what creates the "wow moment")

- Background images with gradient overlays — extract the gradient direction and opacity; implement with **`backgroundOverlay`** on Container (not `root.style`) for blocks/kit JSON
- Section background alternation rhythm — map the exact sequence (white → tinted → white → dark)
- **Styling model:** layout, surface, and typography use **`props.className`** only. **`props.root`** carries allowlisted non-class fields (**`ROOT_KEPT`** in `scripts/TemplateBuilder.js`): animations, patterns, presets, layout metadata, and optional **`root.style`** for CSS effects Tailwind cannot express (`backdrop-filter`, complex shadows). Do **not** use **`root.style`** for gradients over images — use **`backgroundOverlay`** or utilities in **`className`**. New **library / MCP** blocks avoid **`root.style`** unless unavoidable; prefer tokens in **`className`**.
- Card hover states, image treatments, accent color usage patterns

### Step 2: Transfer Techniques to New Context

For each section you build, explicitly check your extracted techniques:

```
Before building: "Which techniques from my extraction am I applying here?"
If the answer is "none" → you're building from muscle memory. Stop and re-read.
```

**What transfers 1:1 (structural patterns):**

- Nav layout (logo | separator | links ... CTA)
- Form card structure (title, subtitle, inputs, CTA, response note)
- Badge/pill styling
- Divider patterns
- Button shapes and icon placement
- Section background rhythm

**What gets replaced (brand identity):**

- Color palette → new palette for new niche
- Copy/text → new copy for new niche
- Imagery → new images for new niche
- Font pairing → can change, but match the weight/contrast ratio
- Business details → new company

### Step 3: Palette & Typography

Identify the reference's **color relationships** (not just the colors):

- What's the accent usage pattern? (CTAs only? Badges + CTAs? Large bands?)
- What creates contrast between sections? (bg alternation? border? shadow?)
- Map to 12 palette slots, or use `list_presets(mood)` and override.

Match **typographic weight contrast**, not specific fonts:

- If reference uses heavy serif headings + light sans body, pick fonts with similar weight range
- Verify Google Font weight availability before committing

### Step 4: Build Section by Section

Build one section at a time. After each, screenshot and verify the techniques are visible:

- Does the eyebrow have the pill/badge treatment from the reference? Or is it plain text?
- Does the hero have the gradient overlay / image treatment? Or is it flat?
- Do the buttons have the right shape/icon/style? Or are they generic rectangles?
- Does the form card have the polish (shadow, subtitle, response note)? Or is it bare inputs?

If a section doesn't show evidence of transferred techniques, fix it before moving on.

### Step 5: The "Could You Tell?" Test

Compare your output to the reference. A viewer should see the family resemblance in _technique_ — similar rhythm, similar polish, similar structural patterns — but NOT mistake it for the same site. Different niche, different palette, different imagery, different copy. Same level of craft.

---

## Inspecting and Debugging

- `read_template(slug)` — dump full node tree for IDs and current props
- `list_blocks()` — available block templates with visual descriptions
- `list_presets(mood?)` — theme presets (18 curated, filterable by mood)
- `get_component_schema(component?)` — component prop reference

**Container overflow vs scroll effects:** `overflow.dragScroll`, `overflow.autoHide`, `overflow.wheelHorizontal`, and `overflow.hideDelay` control **CSS horizontal overflow** (drag-to-scroll and auto-hide scrollbar on strips using `overflow-x-auto` in `className`). They are unrelated to **`scrollEffect`** (`horizontal-scroll` / `scroll-timeline`), which are **GSAP pin/transform** section effects. Do not use both GSAP horizontal-scroll and the overflow props on the same container.

- `get_style_reference()` — full prop key and variable list
- `list_example_blocks(slug)` — blocks in decoded examples
- `extract_block(slug, sectionRootId)` — extract for reuse
- `save_as_block_template(...)` — save to block library
- `audit_accessibility(url/html)` — WCAG audit (Playwright full or jsdom structural)

### Collections (per-site headless CMS)

A site can have arbitrary typed collections (staff, FAQ, menu items, events, business hours, …). Bind in the editor exactly like Stripe products today: drop a `Data` node with `dataSource: { provider: "collection", collection: "<slug>" }` and repeat children with `{{item.<fieldKey>}}`.

- `list_collections()` — see what the active site already has.
- `get_collection(slug)` — full schema, source, isPublic.
- `create_collection({ name, slug, schema, source?, isPublic? })` — `schema` is an array of `{ key, label, type, required?, formWritable?, ...typeConfig }`. Source defaults to `{ type: "manual" }`. For Airtable sync (Business+): `{ type: "airtable", baseId, tableId, viewId?, columnMap: { fieldKey: "Airtable Field Name" } }`. Secrets live in `ConnectorCredential`.
  - `formWritable: false` on a field = public forms can **never** write it (owner-only fields like `status`, `publishedAt`, `price`). Default is writable. Enforced server-side against the DB schema, so it's a real lock, not a UI hint.
- `update_collection_schema(slug, schema)` — replace the field list.
- `delete_collection(slug)` — hard delete + all rows.
- `list_collection_rows(slug, { limit?, cursor? })` — paginated rows.
- `create_collection_row(slug, data)` / `update_collection_row(slug, row_id, data)` / `delete_collection_row(slug, row_id)`.
- `create_collection_rows(slug, rows)` — bulk insert, up to 500 rows/call; all-or-nothing validation (reports the bad `rowIndex`).
- `import_collection_csv(slug, csv, { mode? })` — CSV → rows, columns matched to field keys by name; `mode: append|replace|upsert` (upsert keys on an `externalId`/`id` column). ~8 MB cap.
- `upload_file({ fileUrl?|dataBase64?, mimeType?, filename? })` — upload any plan-allowed file. Image → CDN (`type: "cdn"`); video/audio/pdf/zip → R2 (`type: "r2"`, public `url`). Store the returned `url` in a collection `url`/`media` field or a Video node (`provider: "r2"`, `videoId: mediaId`). `mimeType` required for non-image `dataBase64`. (`upload_image` stays the image-only shortcut.)

Forms can also write into a collection — set `submissionType: "collection"`, `collectionSlug: "<slug>"`, optional `collectionFieldMap: { fieldKey: "formInputName" }` (omit an entry to match by identical name; must be an **object**, a JSON string is ignored), optional `collectionFieldValues: { fieldKey: value }` (constants forced on submit), optional `collectionSkipEmail: true`. Plan-gated like every other collection write. Rules to get it right:
- **Required fields must be fillable.** A required field with no `default` that no form input maps to (or that is `formWritable: false`) makes every submission `400`. Either add a `FormElement` whose `name` matches the field key, map one explicitly, give the field a `default`, or mark it optional. A field with a fixed value in `collectionFieldValues` counts as filled.
- **Locked fields are silently dropped.** Fields with `formWritable: false` are stripped server-side even if you map them — don't rely on a form to set owner-only fields.
- **Fixed values are the moderation primitive.** `collectionFieldValues: { public: false }` makes every form-submitted row land unapproved while dashboard-created rows use your chosen value. It's enforced server-authoritatively (the endpoint reads the saved form node by id, not the request body), so a crafted POST can't spoof `public: true`. A field is EITHER input-mapped OR fixed-valued, not both.

### Concurrency Notes

- `delete_node` and `insert_node` are serialized through a mutex — safe to call rapidly without race conditions on the template file.
- `patch_site_bulk` is atomic on the API side — fetches, patches, and saves in one operation. Prefer it over multiple `patch_site_node` calls when editing several nodes at once.

## pagehub.dev monorepo (when you edit the repo, not only MCP over HTTP)

The main **pagehub.dev** codebase is a **pnpm** workspace: **`pnpm install`** and **`pnpm run build`** from the **repository root**; lockfile **`pnpm-lock.yaml`**. SDK source is **`packages/sdk`** (`@pagehub/sdk`). Authoritative rules for coding agents: repo root **`README.md`**, **`.cursorrules`**, **`CLAUDE.md`**, and **`packages/mcp/README.md`** (section _Working in the pagehub.dev monorepo_).
