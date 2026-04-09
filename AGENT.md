# PageHub MCP — Agent Rules

You are building websites through the PageHub MCP server. Your output must be **production-quality** — not wireframes, not "technically correct," but sites that look like they were designed by a professional. If a block looks generic or unfinished, you failed. Build custom blocks rather than forcing pre-built templates that don't fit.

## Quick Start

Before building anything, call these discovery tools:

1. **`list_blocks`** — see pre-built block templates with visual descriptions
2. **`get_component_schema`** — learn component types and their props
3. **`get_style_reference`** — palette variables, layout props, styling rules
4. **`list_presets`** — curated theme presets by mood
5. **`search_blocks`** — find proven block patterns in the library; use with `apply_kit_block`. Two scopes: `blockType: "section"` (full page sections, default) and `blockType: "component"` (reusable patterns like dropdowns, cards, accordions that go inside sections)

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
8. update_node(slug, nodeId, ...)                 → surgical tweaks
9. audit_accessibility(url/html)                  → check WCAG compliance
10. encode_all_templates()                        → finalize
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

| Pattern | When to use |
|---------|------------|
| `bento-gallery` | Photo-heavy sections needing visual variety (not a flat grid) |
| `rich-contact` | Contact pages with hours, address, map, AND a form |
| `quote-testimonials` | Customer reviews with star ratings |
| `offering-list` | Menus, service lists, pricing rows |
| `split-feature` | Feature sections with text on one side, image on the other |
| `multi-column-footer` | Rich footers with multiple link columns |
| `horizontal-scroller` | Tag strips, category filters, horizontal carousels |

---

## Design Quality Rules

These rules are **as important as the technical rules**. Violating them produces ugly sites that technically render but look amateur.

### 1. Typography Hierarchy

Every page needs at least 4 levels of visual type weight. If all your text looks the same size, the page is flat.

| Level | Use | Example Styling |
|-------|-----|-----------------|
| **Eyebrow / Label** | Section category, badge above headline | text-xs or text-sm, font-bold, tracking-widest, uppercase, accent color |
| **Headline** | Section title, hero headline | text-4xl to text-6xl, heading font family, font-bold, primary color |
| **Subhead / Lead** | Supporting paragraph under headline | text-lg to text-xl, body font, normal weight, secondary/muted color |
| **Body** | Descriptions, card text, paragraphs | text-sm to text-base, body font, normal weight, text color |
| **Meta / Small** | Dates, attribution, captions | text-xs to text-sm, muted/alternate color |

**Rule:** Every section should have an eyebrow OR a headline. Sections with just body text look like placeholders.

### 2. Whitespace and Proportion

- **Section padding:** Use generous vertical padding. Desktop sections should have `py-20` to `py-32`, not `py-8`. Mobile can be `py-12` to `py-20`.
- **Content width:** Constrain content with `max-w-content` and `mx-auto`. Text blocks should be narrower: `max-w-3xl` or `max-w-2xl` for readability.
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

### 7. Icons — Use Google Material Symbols, NOT Emojis

PageHub has a built-in icon system with 2000+ Google Material Symbols. **Never use emoji characters** (☕, →, ▸, ★) as content — they render inconsistently across devices and look unprofessional.

**How icons work:**
- Icons are set on Button components via the `icon` prop
- Format: `icon: { value: "ref-google:icon_name", position: "left", size: "w-5 h-5" }`
- The renderer auto-generates an optimized Google Fonts URL for only the icons used

**Common icon names:**
| Icon | Name | Use for |
|------|------|---------|
| menu | `ref-google:menu` | Hamburger menu |
| close | `ref-google:close` | Close button |
| phone | `ref-google:phone` | Phone links |
| mail | `ref-google:mail` | Email links |
| location_on | `ref-google:location_on` | Address/maps |
| star | `ref-google:star` | Ratings |
| arrow_forward | `ref-google:arrow_forward` | Navigation arrows |
| coffee | `ref-google:coffee` | Cafe/drinks |
| restaurant | `ref-google:restaurant` | Food/dining |
| schedule | `ref-google:schedule` | Hours/time |
| storefront | `ref-google:storefront` | Business/shop |
| music_note | `ref-google:music_note` | Music/audio |
| photo_camera | `ref-google:photo_camera` | Photography |
| facebook | `ref-google:facebook` | Social media |
| check_circle | `ref-google:check_circle` | Checkmarks/success |
| expand_more | `ref-google:expand_more` | Dropdowns |
| open_in_new | `ref-google:open_in_new` | External links |

**Full list:** Browse all icons at https://fonts.google.com/icons (filter by "Material Symbols Outlined")

**Icon-only buttons** (no text, just icon): set `icon.only: true`

**Example — button with icon:**
```json
{
  "text": "Get Directions",
  "url": "#visit",
  "icon": {
    "value": "ref-google:location_on",
    "position": "left",
    "size": "w-5 h-5",
    "gap": "gap-2"
  }
}
```

**CRITICAL: `ref-google:*` ONLY works on Button `icon.value`.** Putting `ref-google:account_balance` as text content in a Text node renders the literal string, not an icon. For icon-only display, use a Button with `icon.only: true`.

**Where NOT to use icons (use Text instead):**
- Star ratings in testimonials — use `★` characters in a Text node (these are content, not UI icons)
- Decorative separators — use `·` or `—` in text
- Arrows in menu lists — these are presentational, a Text node with `→` is acceptable

### 8. Background Overlay (Image + Gradient)

To layer a gradient overlay on top of a background image (e.g. dark hero with readable text), use the `backgroundOverlay` prop on any Container. **Do NOT use `root.style` for this — the overlay prop handles it cleanly.**

**Preset strings (easiest):**
```json
{
  "backgroundImage": "https://...",
  "backgroundOverlay": "dark-left",
  "className": "bg-cover bg-center bg-no-repeat"
}
```

| Preset | Effect |
|--------|--------|
| `dark-left` | Dark gradient from left, fading right |
| `dark-right` | Dark gradient from right, fading left |
| `dark-bottom` | Dark gradient from bottom, fading up |
| `dark-top` | Dark gradient from top, fading down |
| `dark` | Uniform dark overlay |
| `light` | Uniform light overlay |

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
- **Image type:** Use `"type": "url"` for external URLs. Only use `"type": "cdn"` for uploaded media IDs.

**Automatic URL validation:** `add_custom_block`, `update_node`, and `insert_node` send a HEAD request to every image URL before writing. The timeout is 8 seconds. If any URL fails (non-200 status or timeout), the entire operation is **blocked** — you'll get an error listing each bad URL and its status. Fix the URLs and retry.

**What's validated:**
- `Image` component `content` prop (when `type: "url"` or URL starts with `http`)
- `backgroundImage` props on any node

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

#### Buttons & Links
- Icon-only buttons MUST have text in the `text` prop (used as `aria-label` when `icon.only` is true).
- Links to external URLs automatically get `rel="noopener noreferrer"` — no action needed.
- Link text must be descriptive. Never use "Click here" or "Read more" alone — include context: "Read more about our pricing".

#### Color Contrast
- Text on backgrounds must meet **4.5:1** contrast ratio (normal text) or **3:1** (large text 18px+).
- Don't convey information by color alone — add icons or text labels alongside color indicators.
- Use theme palette slots that have been designed for contrast: text on background, primary-text on primary, etc.

#### Navigation
- Every site gets a skip navigation link automatically (built into the renderer).
- Navigation menus use `<nav>` (Container type `"nav"`) — this happens automatically with the Nav component in navbar blocks.
- **Header blocks and MCP structures:** Prefer the **`Nav`** component (not a lone `ButtonList`) for editable desktop links + hamburger + slide overlay. It matches templates (`acme` header) and the library seed `navbar` (`scripts/seed/data/blocks/navbar.block.json`): `menu.id` must match the overlay `Container` `id` and hamburger `click.value`; duplicate link buttons inside the panel `ButtonList` for static/preview (omit `source` unless you have stable Craft node ids).

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
4. None of the above? Build from scratch with `add_custom_block` using the component schema

### The Golden Rule

**Default to `add_custom_block`.** Pre-built templates are shortcuts for common patterns. If the design has any complexity — split layouts, image grids, mixed content, forms with multiple fields — build it custom. It takes slightly longer but the output is 10x better than forcing a generic template.

### Anti-Patterns — NEVER DO THESE

| Anti-pattern | Why it fails | Do this instead |
|---|---|---|
| Using `hero-2` for a split hero with image | hero-2 is centered text only, min-h-screen = huge whitespace | Use `hero-3` or build custom |
| Using `team-1` for testimonials | Team profiles ≠ review quotes | Use `testimonials-1` or build custom quote cards |
| Using `optin-1` for contact form | Single email field ≠ multi-field form | Build custom with Form + multiple FormElements |
| Using `texts-1` for anything complex | It's literally just a centered heading + paragraph | Build custom |
| Forcing ANY pre-built template when it doesn't match | Generic output, broken proportions | Always build custom when no template fits |
| Making every block centered text | Page looks like a PowerPoint slide | Use split layouts, left-aligned text, asymmetric compositions |

---

## Interactive Features

### Animations (Scroll-Triggered)

Components can animate into view when the user scrolls to them. Set `root.animation` to one of these values:

| Animation | Effect | Best For |
|-----------|--------|----------|
| `spring` | Fades in + scales from 0 to 1 (once, on scroll into view) | Cards, images, sections appearing on scroll |
| `hoverGrow` | Scales up on hover, shrinks on tap | Buttons, cards, interactive elements |
| `tween` | Continuous 360° rotation | Loading spinners, decorative elements |

**Example — cards that fade in on scroll:**
```json
{
  "className": "bg-base-200 text-base-content rounded-box border shadow-sm p-6",
  "root": {
    "animation": "spring"
  }
}
```

**Usage:** Apply `spring` to cards, gallery images, testimonial cards, or any element you want to reveal on scroll. Don't apply to every element — use it for visual interest on 2-4 key sections. Overusing animations makes the page feel gimmicky.

**DO NOT animate:** Headers, footers, hero sections (above the fold — already visible), or text-only blocks.

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
Container "Tab Buttons" (ButtonList, flex-row)
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

| Type | Props | Use for |
|------|-------|---------|
| `link-url` | `url`, `target` | External links, absolute URLs |
| `link-page` | `pageId`, `target` | Internal page navigation |
| `scroll-to` | `anchor` | Anchor links to sections (nav → section `id`) |
| `email` | `email`, `subject?`, `body?` | Contact email (renders as `mailto:`) |
| `phone` | `phone` | Phone numbers (renders as `tel:`) |
| `copy-to-clipboard` | `text` | Copy text on click |
| `download-file` | `url`, `filename?` | File download trigger |

**Button-only action types (not on Text):**

| Type | Props | Use for |
|------|-------|---------|
| `show-hide` | `target`, `direction`, `method`, `group?` | Mobile menus, dropdowns, tabs |
| `open-modal` | `anchor` | Open a modal by ID |

**Examples:**
```json
// External link on a Text heading
{ "text": "PageHub", "tagName": "h3", "action": { "type": "link-url", "url": "https://pagehub.dev", "target": "_blank" } }

// Nav button scrolling to a section
{ "text": "Contact", "action": { "type": "scroll-to", "anchor": "contact" } }

// Email button
{ "text": "hello@example.com", "action": { "type": "email", "email": "hello@example.com" } }

// Mobile menu toggle (Button only — must use method: "style")
{ "text": "", "icon": { "value": "ref-google:menu" }, "action": { "type": "show-hide", "target": "mobile-nav", "direction": "toggle", "method": "style" } }
```

**Rules:**
- Nav links to page sections: use `scroll-to`, not `link-url` with `#anchor`
- Contact email/phone: use `email`/`phone` types, not `link-url` with `mailto:`/`tel:`
- Mobile nav overlays: `show-hide` with `method: "style"` (container needs `root.style: "display: none;"`)
- External links: always `target: "_blank"` (gets `rel="noopener noreferrer"` automatically)

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
- **`max-w-content`** is Tailwind's `max-width: max-content` (shrinks to content). NEVER use for layout containers. Use `max-w-(--content-width)` or `max-w-7xl`.
- **Font family** goes in className only: `font-heading`, `font-body`, or `font-['Font_Name']`. NEVER put font-family in `root.style`. NEVER add Google Fonts `<link>` in `ROOT.props.header` — the system loads fonts automatically.

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

| Wrong (one Text node) | Right (separate nodes) |
|---|---|
| `"123 Main St<br/>Los Angeles<br/>(555) 123-4567"` | 3 Text nodes: street, city, phone — each with own styling |
| `"© 2026 Acme · <a href='/privacy'>Privacy</a> · <a href='/terms'>Terms</a>"` | 1 Text node for copyright + ButtonList with link buttons |
| `"Company Name<br/>Tagline<br/>Address"` | Container with 3 child Text nodes |

**Why:** Each Text node can have its own `tagName`, `fontSize`, `fontWeight`, `color`. When you cram everything into one node, you lose all typographic control. The footer example above — copyright, address, and nav links all in one `<p>` — means you can't style the nav links differently from the address, can't change font sizes, can't adjust spacing between lines.

**Allowed inline formatting** (within a SINGLE text purpose):
- `<strong>`, `<em>` — bold/italic emphasis within a sentence
- `<span style="...">` — inline color/style within a sentence
- `<br/>` — ONLY for line breaks within the SAME content block (e.g. a multi-line address)

**NEVER in text values:**
- `<p>`, `<div>`, `<h1>`-`<h6>` — use `tagName` prop instead
- `<a>` tags for navigation links — use Button components instead (they get proper hover states, click tracking, and accessibility)
- Multiple `<br/>` to create spacing — use separate nodes with margin/padding
- Complex HTML with classes — this bypasses the design system

**Footer example — right way:**
```
ftr_inner (Container, flex-col, gap-space-md, items-center)
  ├── ftr_brand (Text, "{{company.name}}", h3, font-bold, text-lg)
  ├── ftr_address (Text, "{{company.address}} · {{company.location}}", p, text-sm, muted)
  ├── ftr_links (ButtonList, flex-row, gap-4)
  │     ├── Button "Privacy" → /privacy (link link-hover, text-sm)
  │     ├── Button "Terms" → /terms (link link-hover, text-sm)
  │     └── Button "{{company.phone}}" → tel:{{company.phone}} (link link-hover, text-sm)
  ├── ftr_divider (Divider or Container with border-t border-base-300 pt-space-sm)
  ├── ftr_social (ButtonList, flex-row, gap-space-xs)
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

| Character | Entity | Use |
|-----------|--------|-----|
| © | `&copy;` | Copyright |
| — | `&mdash;` | Em dash |
| – | `&ndash;` | En dash |
| · | `&middot;` | Middle dot separator |
| → | `&rarr;` | Arrow (in text, not icons) |
| " " | `&ldquo;` `&rdquo;` | Smart quotes |
| ' ' | `&lsquo;` `&rsquo;` | Smart apostrophes |
| & | `&amp;` | Ampersand (when literal) |
| ™ | `&trade;` | Trademark |
| ® | `&reg;` | Registered |

### Template Variables — Never Hardcode Business Info

| Variable | Use |
|----------|-----|
| `{{company.name}}` | Business name |
| `{{company.tagline}}` | Tagline |
| `{{company.location}}` | City, State |
| `{{company.address}}` | Street address |
| `{{company.phone}}` | Phone |
| `{{company.email}}` | Email |
| `{{year}}` | Current year |

### className Utilities Reference

All styling goes in a single `props.className` string. Common utilities:

| Category | Examples |
|----------|---------|
| Display | `flex`, `grid`, `block`, `hidden` |
| Flex | `flex-row`, `flex-col`, `items-center`, `justify-between` |
| Grid | `grid-cols-1` to `grid-cols-12` |
| Gap | `gap-4`, `gap-container` |
| Width | `w-full`, `w-1/2`, `w-[75%]` |
| Max width | `max-w-content`, `max-w-3xl` |
| Height | `h-auto`, `h-[400px]`, `min-h-screen` |
| Padding | `py-20`, `px-6`, `p-8` |
| Margin | `mx-auto`, `mt-4` |
| Position | `relative`, `absolute`, `z-10` |
| Overflow | `overflow-hidden`, `overflow-auto` |
| Background | `bg-primary`, `bg-base-200`, `bg-transparent` |
| Text color | `text-base-content`, `text-primary-content` |
| Border | `border`, `border-(--card)`, `border-2` |
| Radius | `rounded-box`, `rounded-box` |
| Shadow | `shadow-sm`, `shadow-md`, `shadow-lg` |
| Typography | `text-4xl`, `font-bold`, `leading-relaxed` |

Desktop overrides use `md:` prefix: `md:flex-row md:gap-8 md:py-24`

### Node Structure (for add_custom_block)


```json
{
  "type": { "resolvedName": "Container" },
  "isCanvas": true,
  "props": {
    "canDelete": true, "canEditName": true,
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
| Element | What to look for | Example extraction |
|---------|-----------------|-------------------|
| **Eyebrow badges** | Pill shape? Colored dot prefix? Background fill? Border? | "Rounded-full pill, bg-gray-100, text-xs tracking-widest, gold dot before text" |
| **Buttons** | Shape, fill, icon, hover effect | "Dark pill buttons with arrow_forward icon right, text-swap on hover" |
| **Dividers** | Vertical between stats? Accent underlines? Border widths? | "1px vertical divider between stat blocks, border-neutral/30 opacity" |
| **Stat numbers** | Oversized with suffix? Colored? Font contrast? | "Giant 72px heading-font number + smaller 24px 'Y+' suffix inline" |
| **Section labels** | Just text? In a badge? With icon/dot? | "Pill badge with colored dot + uppercase text, not plain uppercase" |

#### Typography tricks
| Trick | What to look for |
|-------|-----------------|
| **Fading text** | Last line of a paragraph in muted/lighter color — draws reader in then trails off |
| **Size contrast** | Massive stat numbers vs tiny labels. Large serif heading vs small sans body |
| **Mixed families** | Serif headings + sans body creates instant sophistication |
| **Weight play** | Thin body text (300) vs black headings (900) within same family |

#### Layout structures (copy these 1:1 — they're patterns, not identity)
| Pattern | What to look for |
|---------|-----------------|
| **Nav** | Logo position, separator line, link arrangement, right-side CTA button styling |
| **Hero** | Full-bleed image + overlay? Split layout? Centered text-only? What's the gradient? |
| **Split sections** | Column ratio, vertical alignment, what goes on each side |
| **Card grids** | Column count, card styling (border vs shadow vs bg), internal layout |
| **Form cards** | Shadow, border-radius, header text, subtitle, response-time note, input styling |
| **Footer** | Column count, link grouping, dark/light, social icon placement |

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

Compare your output to the reference. A viewer should see the family resemblance in *technique* — similar rhythm, similar polish, similar structural patterns — but NOT mistake it for the same site. Different niche, different palette, different imagery, different copy. Same level of craft.

---

## Inspecting and Debugging

- `read_template(slug)` — dump full node tree for IDs and current props
- `list_blocks()` — available block templates with visual descriptions
- `list_presets(mood?)` — theme presets (18 curated, filterable by mood)
- `get_component_schema(component?)` — component prop reference
- `get_style_reference()` — full prop key and variable list
- `list_example_blocks(slug)` — blocks in decoded examples
- `extract_block(slug, sectionRootId)` — extract for reuse
- `save_as_block_template(...)` — save to block library
- `audit_accessibility(url/html)` — WCAG audit (Playwright full or jsdom structural)

### Concurrency Notes

- `update_node`, `delete_node`, and `insert_node` are serialized through a mutex — safe to call rapidly without race conditions on the template file.
- `patch_site_bulk` is atomic on the API side — fetches, patches, and saves in one operation. Prefer it over multiple `patch_site_node` calls when editing several nodes at once.

## pagehub.dev monorepo (when you edit the repo, not only MCP over HTTP)

The main **pagehub.dev** codebase is a **pnpm** workspace: **`pnpm install`** and **`pnpm run build`** from the **repository root**; lockfile **`pnpm-lock.yaml`**. SDK source is **`packages/sdk`** (`@pagehub/sdk`). Authoritative rules for coding agents: repo root **`README.md`**, **`.cursorrules`**, **`CLAUDE.md`**, and **`packages/mcp/README.md`** (section *Working in the pagehub.dev monorepo*).
