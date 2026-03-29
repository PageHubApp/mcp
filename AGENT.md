# PageHub MCP — Agent Rules

You are building websites through the PageHub MCP server. Your output must be **production-quality** — not wireframes, not "technically correct," but sites that look like they were designed by a professional. If a section looks generic or unfinished, you failed. Build custom sections rather than forcing pre-built templates that don't fit.

## Quick Start

Before building anything, call these discovery tools:

1. **`list_sections`** — see pre-built section templates with visual descriptions
2. **`get_component_schema`** — learn component types and their props
3. **`get_style_reference`** — palette variables, layout props, styling rules
4. **`list_presets`** — curated theme presets by mood
5. **`get_design_patterns`** — concrete node structure recipes for rich layouts

## Build Workflow

```
1. create_template(slug)         → scaffold empty template
2. set_theme(slug, preset, ...)  → set colors, fonts, spacing
3. add_section / add_custom_section (repeat for each section)
4. set_nav(slug, ...)            → header navigation + mobile menu
5. set_footer(slug, ...)         → footer text and colors
6. update_node(slug, nodeId, ..) → surgical tweaks
7. encode_all_templates()        → finalize
```

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
- **Content width:** Constrain content with `max-w-[var(--ph-content-width)]` and `mx-auto`. Text blocks should be narrower: `max-w-3xl` or `max-w-2xl` for readability.
- **Gap hierarchy:** Gaps between sections > gaps between content blocks > gaps between elements. Example: section py=24, content gap=12, element gap=4.
- **Asymmetric spacing:** Not everything needs to be centered. Left-aligned text with right-side images creates visual tension. Use `items-start` and `text-left` on editorial sections.

### 3. Image Treatment

- **Always set height AND width** on images. `w-full` + `h-[400px]` or `h-[500px]` with `object-cover`. Never leave images to auto-size — they collapse or stretch.
- **Aspect ratios:** Hero images should be tall (h-[500px] to h-[600px] desktop). Card images should be landscape (h-48 to h-64). Gallery images should vary for visual interest.
- **Rounded corners:** Use `rounded-[var(--ph-border-radius)]` or `rounded-lg`. Sharp-cornered images look unfinished unless the design is intentionally brutalist.
- **Shadows on images:** `shadow-lg` or `shadow-2xl` on hero/feature images adds depth. Don't put shadows on every image.
- **Object fit:** Almost always `object-cover`. Only use `object-contain` for logos or icons.

### 4. Card Design

Cards (feature cards, testimonial cards, pricing cards) need these properties to not look flat:

```
root: {
  background: "bg-[var(--ph-alternate-background)]" or "bg-[var(--ph-background)]",
  radius: "rounded-[var(--ph-border-radius)]" or "rounded-lg",
  border: "border",
  borderColor: "border-[var(--ph-alternate-background)]",
  shadow: "shadow-sm" or "shadow-md"
}
mobile: {
  p: "p-6" to "p-8",
  display: "flex",
  flexDirection: "flex-col",
  gap: "gap-3" to "gap-4"
}
```

**Rule:** Cards without padding, border, AND either shadow or background look like unstyled divs. Always apply all three.

### 5. Form & Button Styling

Forms are the most commonly broken element. Without explicit styling, they look like unstyled HTML from 1999.

**Buttons (especially submit):**
```
root: {
  background: "bg-[var(--ph-primary)]",
  color: "text-[var(--ph-primary-text)]",
  radius: "rounded-[var(--ph-border-radius)]"
}
mobile: {
  width: "w-full",
  py: "py-3.5",
  px: "px-6",
  fontWeight: "font-semibold",
  fontSize: "text-sm",
  textAlign: "text-center",
  display: "flex",
  justifyContent: "justify-center",
  alignItems: "items-center"
}
```

**Rule:** Buttons MUST have: padding (py AND px), font-weight, border-radius, background + text color. A button without these looks broken. Submit buttons should be `w-full` inside forms.

**Form elements** get their styling from the theme's `styleGuide` input tokens. These MUST be set in `set_theme` — without them, inputs render as barely-visible browser defaults.

**Required input tokens in styleGuide:**
```json
{
  "inputBorderWidth": "1px",
  "inputBorderColor": "#b8b0a0",
  "inputBorderRadius": "0.5rem",
  "inputPadding": "0.875rem 1rem",
  "inputBgColor": "#ffffff",
  "inputTextColor": "#1a1a1a",
  "inputPlaceholderColor": "#8a8a7a",
  "inputFocusRing": "2px",
  "inputFocusRingColor": "#2d4a3e"
}
```

**Key rule:** The `inputBorderColor` must be **visibly different** from the surrounding background. If your card background is `#f5f0e8` (cream), don't use `#e2e8f0` (light gray) — use something with real contrast like `#b8b0a0`. Test: can you SEE the border? If you have to squint, it's too subtle.

**FormElement nodes MUST include explicit root styling.** CraftJS overrides component defaults when `root: {}` is present in the JSON, so empty root = unstyled inputs. Every FormElement MUST have:

```json
{
  "root": {
    "border": "border",
    "borderWidth": "border-[var(--ph-input-border-width)]",
    "borderStyle": "border-solid",
    "borderColor": "border-[color:var(--ph-input-border-color)]",
    "radius": "rounded-[var(--ph-input-border-radius)]",
    "background": "bg-[var(--ph-input-bg-color)]",
    "color": "text-[color:var(--ph-input-text-color)]"
  },
  "mobile": {
    "p": "p-[var(--ph-input-padding)]",
    "width": "w-full"
  }
}
```

**This is non-negotiable.** Copy this exact root/mobile block onto every FormElement node. The CSS variables pull values from the styleGuide tokens you set in `set_theme`.

**Form card wrapper:** Always wrap forms in a card container with:
- Background (`bg-[var(--ph-background)]`)
- Padding (`p-8` to `p-10`)
- Border radius
- Shadow (`shadow-md`)
- Gap between fields (`gap-4` to `gap-5`)

### 6. Data Display (Hours, Prices, Stats)

Tabular data like hours, pricing rows, or stats need tight, consistent formatting:

- **Hours rows:** Use `flex-row` + `justify-between` with compact padding (`py-2` to `py-3`). Days should be `font-medium`, times should be muted color. Keep font size consistent (`text-sm`).
- **NO excessive vertical spacing** on data rows. `py-2` is enough. `py-6` makes hours look like they're floating in space.
- **Separator lines:** Use `border-b` + `border-[var(--ph-alternate-background)]` between rows for visual structure if needed — but don't overdo it. The reference site uses clean rows without heavy dividers.
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

**Where NOT to use icons (use Text instead):**
- Star ratings in testimonials — use `★` characters in a Text node (these are content, not UI icons)
- Decorative separators — use `·` or `—` in text
- Arrows in menu lists — these are presentational, a Text node with `→` is acceptable

### 8. Image Validation

- **Use reliable image sources.** Unsplash URLs with `?w=600` or `?w=800` are reliable. Always include width parameter.
- **Never use placeholder URLs** like `via.placeholder.com` or broken CDN links.
- **Alt text is required** on every image. It should describe what's in the image, not be generic ("image 1").
- **Image type:** Use `"type": "url"` for external URLs. Only use `"type": "cdn"` for uploaded media IDs.

### 8. Color Usage

- **Alternate section backgrounds:** Every 2nd or 3rd section should have `bg-[var(--ph-alternate-background)]` to create visual rhythm. Don't make every section the same background.
- **Dark accent bands:** Use `bg-[var(--ph-primary)]` with `text-[var(--ph-primary-text)]` for CTA or statement sections. These break up the page and add drama.
- **Accent color sparingly:** Use `var(--ph-accent)` for CTAs, badges, links, and small highlights — not large backgrounds (unless it's a CTA band).
- **Text color matching:** Body text on default bg uses `var(--ph-text)`. Muted/supporting text uses `var(--ph-alternate-text)`. Text on colored backgrounds MUST use the matching `-text` variable.

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

---

## Section Building — Pre-built vs Custom

### Decision Tree

For EVERY section, follow this process:

1. Call `list_sections` — does a template **actually match** the layout?
   - Match the VISUAL DESCRIPTION, not just the name
   - "Kinda close" = NOT a match
2. Call `get_design_patterns` — is there a recipe for this layout type?
   - YES → use the recipe with `add_custom_section`
3. Call `list_example_sections` on decoded examples — similar section in an existing site?
   - YES → `extract_section` → adapt → `add_custom_section`
4. None of the above? Build from scratch with `add_custom_section` using the component schema

### The Golden Rule

**Default to `add_custom_section`.** Pre-built templates are shortcuts for common patterns. If the design has any complexity — split layouts, image grids, mixed content, forms with multiple fields — build it custom. It takes slightly longer but the output is 10x better than forcing a generic template.

### Anti-Patterns — NEVER DO THESE

| Anti-pattern | Why it fails | Do this instead |
|---|---|---|
| Using `hero-2` for a split hero with image | hero-2 is centered text only, min-h-screen = huge whitespace | Use `hero-3` or build custom |
| Using `team-1` for testimonials | Team profiles ≠ review quotes | Use `testimonials-1` or build custom quote cards |
| Using `optin-1` for contact form | Single email field ≠ multi-field form | Build custom with Form + multiple FormElements |
| Using `texts-1` for anything complex | It's literally just a centered heading + paragraph | Build custom |
| Forcing ANY pre-built template when it doesn't match | Generic output, broken proportions | Always build custom when no template fits |
| Making every section centered text | Page looks like a PowerPoint slide | Use split layouts, left-aligned text, asymmetric compositions |

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
  "root": {
    "background": "bg-[var(--ph-alternate-background)]",
    "animation": "spring"
  }
}
```

**Usage:** Apply `spring` to cards, gallery images, testimonial cards, or any element you want to reveal on scroll. Don't apply to every element — use it for visual interest on 2-4 key sections. Overusing animations makes the page feel gimmicky.

**DO NOT animate:** Headers, footers, hero sections (above the fold — already visible), or text-only blocks.

### Tabs / Show-Hide Content Switching

Buttons can show, hide, or toggle other elements by DOM ID. This enables tab interfaces, content swaps, and interactive menus.

**How it works:**

1. Give the target container a DOM `id` prop:
```json
{
  "id": "tab-coffee",
  "mobile": { "display": "flex", ... }
}
```

2. Give the target that should start hidden a `display: "hidden"` in mobile:
```json
{
  "id": "tab-food",
  "mobile": { "display": "hidden", ... }
}
```

3. Add `click` prop to the tab buttons:
```json
{
  "text": "Coffee & Drinks",
  "click": { "type": "click", "direction": "show", "value": "tab-coffee" }
}
```

**Click directions:**
| Direction | Behavior |
|-----------|----------|
| `show` | Makes the target element visible |
| `hide` | Hides the target element |
| `toggle` | Toggles visibility (used for mobile menus) |

**Tab pattern — two content panels:**
```
Tab Button "Coffee" → click: { direction: "show", value: "tab-coffee" }
                     + click on same button also needs to hide the other:
                       create a second hidden button or use JS-free approach below

Tab Button "Food"   → click: { direction: "show", value: "tab-food" }
```

**Simpler approach for tabs:** Since our click system only targets one element per button, the cleanest tab pattern is:
- Use `toggle` on each tab button targeting its own panel
- Start all panels except the first as `display: "hidden"`
- Each tab button toggles its own panel visible

**Example node structure for tabs:**
```
Container "Tab Buttons" (ButtonList, flex-row)
  ├── Button "Coffee" → click: { type: "click", direction: "toggle", value: "panel-coffee" }
  └── Button "Food" → click: { type: "click", direction: "toggle", value: "panel-food" }

Container "Panel Coffee" (id: "panel-coffee", display: flex) ← visible by default
  └── (coffee menu items)

Container "Panel Food" (id: "panel-food", display: hidden) ← starts hidden
  └── (food menu items)
```

---

## Critical Technical Rules

### Colors — ALWAYS Use CSS Variables

```
✅ "bg-[var(--ph-primary)]"     ❌ "bg-black"
✅ "text-[var(--ph-primary-text)]"  ❌ "text-white"
✅ "border-[var(--ph-alternate-background)]"  ❌ "border-gray-200"
```

Exception: `bg-transparent`, opacity modifiers (`bg-white/10`).

Match text to background: `bg-[var(--ph-primary)]` → `text-[var(--ph-primary-text)]`.

### Palette Slot Order (12 slots)

```
 0: Primary / 1: Primary Text
 2: Secondary / 3: Secondary Text
 4: Accent / 5: Accent Text
 6: Neutral / 7: Neutral Text
 8: Background / 9: Text
10: Alternate Background / 11: Alternate Text
```

### Spacing — Flows Inward

```
ROOT → NO gap/padding/margin
  └─ page_home → NO gap/padding/margin
       └─ section → YES: py, px, gap
            └─ content → gap, padding
                 └─ elements → sizing
```

### Responsive — Mobile First

- `props.mobile` → base styles (all sizes)
- `props.desktop` → `md:` prefixed (768px+)

```json
{ "mobile": { "flexDirection": "flex-col", "gridCols": "grid-cols-1" },
  "desktop": { "flexDirection": "flex-row", "gridCols": "grid-cols-3" } }
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
ftr_inner (Container, flex-col, gap-4, items-center)
  ├── ftr_brand (Text, "{{company.name}}", h3, font-bold)
  ├── ftr_address (Text, "{{company.address}} · {{company.location}}", p, text-sm, muted)
  ├── ftr_links (ButtonList, flex-row, gap-4)
  │     ├── Button "Privacy" → /privacy (bg-transparent, text-sm)
  │     ├── Button "Terms" → /terms (bg-transparent, text-sm)
  │     └── Button "{{company.phone}}" → tel:{{company.phone}} (bg-transparent, text-sm)
  └── ftr_copyright (Text, "© {{year}} {{company.name}}", p, text-xs, muted)
```

**Link colors:** Links in ButtonList get their color from the button's `root.color` prop. For footer links on dark backgrounds, use `text-[var(--ph-primary-text)]`. For body links, the styleGuide `linkColor` and `linkHoverColor` tokens control `<a>` tag colors — set these in `set_theme` if the defaults don't match your palette.

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

### Layout Prop Keys

| Key | Values |
|-----|--------|
| display | `"flex"`, `"grid"`, `"block"`, `"none"` |
| flexDirection | `"flex-row"`, `"flex-col"` |
| gridCols | `"grid-cols-1"` to `"grid-cols-12"` (NOT gridTemplateColumns) |
| gap | `"gap-4"`, `"gap-[var(--ph-container-gap)]"` |
| alignItems | `"items-start"`, `"items-center"`, `"items-end"` |
| justifyContent | `"justify-start"`, `"justify-center"`, `"justify-between"` |
| width | `"w-full"`, `"w-1/2"`, `"w-[75%]"` |
| maxWidth | `"max-w-[var(--ph-content-width)]"` |
| height | `"h-auto"`, `"h-[400px]"` |
| py/px/p | `"py-20"`, `"px-6"` |
| mx | `"mx-auto"` |
| position | `"relative"`, `"absolute"` |
| overflow | `"overflow-hidden"` |

### Node Structure (for add_custom_section)

```json
{
  "type": { "resolvedName": "Container" },
  "isCanvas": true,
  "props": {
    "canDelete": true, "canEditName": true,
    "type": "section",
    "root": { "background": "bg-[var(--ph-background)]" },
    "mobile": { "display": "flex", "flexDirection": "flex-col", "width": "w-full", "py": "py-16", "px": "px-6" },
    "desktop": { "py": "py-24" },
    "custom": { "displayName": "Section Name" }
  },
  "displayName": "Container",
  "parent": "page_home",
  "nodes": ["child_1", "child_2"],
  "linkedNodes": {}
}
```

---

## Design Analysis — From Reference to Template

When given a design reference (screenshot, description, or URL):

### 1. Decompose Sections (top to bottom)
List every section with: layout type, column count, key elements, visual weight (light/dark/accented), and background color.

### 2. Map Each Section
For each: check `list_sections` → check `get_design_patterns` → check `list_example_sections` → build custom. **Most sections from a polished reference will need custom builds.**

### 3. Extract Palette
Identify dominant colors → map to 12 slots. Or use `list_presets(mood)` and override specific slots.

### 4. Match Typography
Heading: serif or sans? → find Google Font match. Body: clean sans-serif. Set in `set_theme` styleGuide.

### 5. Build and Verify
After building, review every section against the reference. Use `update_node` to fix spacing, colors, typography until it matches.

---

## Inspecting and Debugging

- `read_template(slug)` — dump full node tree for IDs and current props
- `list_sections()` — available templates with visual descriptions
- `list_presets(mood?)` — theme presets
- `get_component_schema(component?)` — component prop reference
- `get_style_reference()` — full prop key and variable list
- `get_design_patterns(pattern?)` — concrete node recipes for rich layouts
- `list_example_sections(slug)` — sections in decoded examples
- `extract_section(slug, sectionRootId)` — extract for reuse
- `save_as_section_template(...)` — save to template library
