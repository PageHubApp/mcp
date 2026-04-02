const path = require('path');
const { getProjectDir, config, apiFetch, getActiveSiteId, getEditorUrl, delegateHandlers } = require('../config');
const { parseMaybeJson, applyNodePatches, validateImageUrls, collectAllImageUrls, extractImageUrls } = require('../helpers');

// Node-level tools delegated to mcp-core
const coreNodes = require('@pagehub/mcp-core/src/handlers/nodes');
const delegatedNodes = delegateHandlers(coreNodes);

/**
 * Helper: GET site content from API, return { siteId, flat, data }.
 */
async function fetchSite(args) {
  const siteId = getActiveSiteId(args);
  const data = await apiFetch(`/api/v1/sites/${encodeURIComponent(siteId)}`);
  if (!data.content || typeof data.content !== 'object') {
    throw new Error('Site has no decoded content (empty or corrupt).');
  }
  return { siteId, flat: JSON.parse(JSON.stringify(data.content)), data };
}

/**
 * Helper: PUT site content back to API.
 */
async function saveSite(siteId, flat, extra = {}) {
  const body = { content: flat, ...extra };
  const put = await apiFetch(`/api/v1/sites/${encodeURIComponent(siteId)}`, { method: 'PUT', body });
  return { id: put.id, url: getEditorUrl(put.id) };
}

/**
 * Helper: get a TemplateBuilder loaded with site content from API.
 */
function getTemplateBuilder() {
  return require(path.join(getProjectDir(), 'scripts/TemplateBuilder.js'));
}

/**
 * Fetch all components from API and build templateId → structure index.
 * This replaces the filesystem-based template loading in TemplateBuilder.
 */
async function loadTemplateIndex() {
  const data = await apiFetch('/api/v1/components?limit=500');
  const idx = {};
  for (const comp of data.components || []) {
    // Fetch full structure (list view excludes it)
    const full = await apiFetch(`/api/v1/components/${encodeURIComponent(comp.slug)}`);
    if (full.component?.structure) {
      idx[comp.slug] = full.component.structure;
    }
  }
  return idx;
}

async function tbFromSite(args) {
  const TemplateBuilder = getTemplateBuilder();
  const { siteId, flat } = await fetchSite(args);
  const tb = TemplateBuilder.fromNodes(flat, getProjectDir(), { slug: siteId });
  return { siteId, tb };
}

module.exports = {
  async create_template(args) {
    const TemplateBuilder = getTemplateBuilder();
    // Build empty template from acme base in memory
    const tb = TemplateBuilder.fromAcme(getProjectDir(), {
      slug: args.slug || 'new-site',
      title: args.title || 'New Template',
      description: args.description || '',
      image: args.image || '',
      hidden: args.hidden === true,
      homePage: true,
    });
    // Save as a new site via API
    const data = await apiFetch('/api/v1/sites', {
      method: 'POST',
      body: {
        content: tb.nodes,
        name: args.title || args.slug || 'New Site',
        title: args.title,
        description: args.description,
      },
    });
    config.activeSite = { id: data.id, name: data.name, draftId: data.draftId };
    return {
      content: [{
        type: 'text',
        text: `Site created: ${data.id}\nEditor: ${getEditorUrl(data.id)}\nPreview: ${data.staticUrl}\n\nAuto-selected as active site. Next: set_theme, then add_section.`,
      }],
    };
  },

  async set_theme(args) {
    const TemplateBuilder = getTemplateBuilder();
    const { id, preset, palette, styleGuide, fonts, jsonLd } = args;

    let siteId, tb;
    // If no existing site, create from acme base
    const targetId = id || config.activeSite?.id;
    if (!targetId) {
      // Create new site first
      const result = await module.exports.create_template(args);
      return result;
    }

    ({ siteId, tb } = await tbFromSite({ id: targetId }));

    let resolvedPalette = parseMaybeJson(palette);
    let resolvedStyleGuide = parseMaybeJson(styleGuide);
    let resolvedFonts = parseMaybeJson(fonts);
    if (preset) {
      const presetData = await apiFetch(`/api/v1/presets/${encodeURIComponent(preset)}`);
      const found = presetData.preset;
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

    const result = await saveSite(siteId, tb.nodes);
    const presetMsg = preset ? ` (preset: ${preset})` : '';
    return { content: [{ type: 'text', text: `Theme saved${presetMsg}.\nEditor: ${result.url}` }] };
  },

  async add_section(args) {
    const { templateId, contentOverrides, propOverrides, position, pageId } = args;
    const { siteId, tb } = await tbFromSite(args);
    // Load component structures from API so TemplateBuilder can find them
    const templateIndex = await loadTemplateIndex();
    tb.setTemplateIndex(templateIndex);
    tb.addSection(templateId, {
      contentOverrides: parseMaybeJson(contentOverrides) || {},
      propOverrides: parseMaybeJson(propOverrides) || {},
      position,
      pageId,
    });
    const result = await saveSite(siteId, tb.nodes);
    return { content: [{ type: 'text', text: `Section ${templateId} added.\nEditor: ${result.url}` }] };
  },

  async add_custom_section(args) {
    const { sectionRootId, nodes, parentNodeId, position } = args;
    const { siteId, tb } = await tbFromSite(args);
    const nodeMap = parseMaybeJson(nodes);
    if (!nodeMap || typeof nodeMap !== 'object') throw new Error('nodes must be an object map');
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
    const result = await saveSite(siteId, tb.nodes);
    return { content: [{ type: 'text', text: `Custom section ${sectionRootId} added. (${allImgUrls.length} image URLs validated)\nEditor: ${result.url}` }] };
  },

  async set_nav(args) {
    const { menuId, menuTitle, logoText, logoFont, headerBg, headerColor, links, phone } = args;
    const { siteId, tb } = await tbFromSite(args);
    tb.setNav({
      menuId, menuTitle, logoText, logoFont, headerBg, headerColor,
      links: parseMaybeJson(links) || [],
      phone: parseMaybeJson(phone),
    });
    const result = await saveSite(siteId, tb.nodes);
    return { content: [{ type: 'text', text: `Nav updated.\nEditor: ${result.url}` }] };
  },

  async set_footer(args) {
    const { contentBackground, contentColor, copyrightHtml, copyrightTagName, copyrightRootColor } = args;
    const { siteId, tb } = await tbFromSite(args);
    tb.setFooter({ contentBackground, contentColor, copyrightHtml, copyrightTagName, copyrightRootColor });
    const result = await saveSite(siteId, tb.nodes);
    return { content: [{ type: 'text', text: `Footer updated.\nEditor: ${result.url}` }] };
  },

  // Node-level tools — delegated to mcp-core
  update_node: delegatedNodes.update_node,
  delete_node: delegatedNodes.delete_node,
  insert_node: delegatedNodes.insert_node,
  set_integrations: delegatedNodes.set_integrations,
  set_redirects: delegatedNodes.set_redirects,
};
