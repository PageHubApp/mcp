const path = require("path");
const {
  getProjectDir,
  config,
  apiFetch,
  getActiveTarget,
  getEditorUrl,
  delegateHandlers,
} = require("../config");
const {
  parseMaybeJson,
  applyNodePatches,
  validateImageUrls,
  collectAllImageUrls,
  extractImageUrls,
} = require("../helpers");
const { stampRootSource } = require("@pagehub/mcp-core/src/structure-ingest");
const {
  normalizeDesignTags,
  truncateDesignNotes,
} = require("@pagehub/mcp-core/src/root-design-intent");
const { validateNodes, formatValidationReport } = require("@pagehub/mcp-core/src/node-validation");

// Node-level tools delegated to mcp-core
const coreNodes = require("@pagehub/mcp-core/src/handlers/nodes");
const delegatedNodes = delegateHandlers(coreNodes);

/**
 * Helper: fetch content for the active target (site or template).
 */
async function fetchForTarget(args) {
  const target = getActiveTarget(args);
  if (!config.targetRevisions || typeof config.targetRevisions !== "object") {
    config.targetRevisions = {};
  }
  if (target.type === "template") {
    const data = await apiFetch(`/api/v1/templates/${encodeURIComponent(target.id)}`);
    if (!data.content || typeof data.content !== "object") {
      throw new Error("Template has no decoded content (empty or corrupt).");
    }
    if (Number.isFinite(Number(data.version))) {
      config.targetRevisions[`template:${target.id}`] = { expectedVersion: Number(data.version) };
    }
    return {
      targetId: target.id,
      targetType: "template",
      flat: JSON.parse(JSON.stringify(data.content)),
      data,
    };
  }
  const data = await apiFetch(`/api/v1/sites/${encodeURIComponent(target.id)}`);
  if (!data.content || typeof data.content !== "object") {
    throw new Error("Site has no decoded content (empty or corrupt).");
  }
  if (data.updatedAt) {
    config.targetRevisions[`site:${target.id}`] = { expectedUpdatedAt: String(data.updatedAt) };
  }
  return {
    targetId: target.id,
    targetType: "site",
    flat: JSON.parse(JSON.stringify(data.content)),
    data,
  };
}

/**
 * Helper: save content for the active target (site or template).
 */
async function saveForTarget(targetId, targetType, flat, extra = {}) {
  if (!config.targetRevisions || typeof config.targetRevisions !== "object") {
    config.targetRevisions = {};
  }
  const revision = config.targetRevisions[`${targetType}:${targetId}`] || {};
  const body = { content: flat, ...revision, ...extra };
  if (targetType === "template") {
    const put = await apiFetch(`/api/v1/templates/${encodeURIComponent(targetId)}`, {
      method: "PUT",
      body,
    });
    if (Number.isFinite(Number(put.version))) {
      config.targetRevisions[`template:${targetId}`] = { expectedVersion: Number(put.version) };
    }
    return { id: put.slug || targetId, url: null, type: "template" };
  }
  const put = await apiFetch(`/api/v1/sites/${encodeURIComponent(targetId)}`, {
    method: "PUT",
    body,
  });
  if (put.updatedAt) {
    config.targetRevisions[`site:${targetId}`] = { expectedUpdatedAt: String(put.updatedAt) };
  }
  return { id: put.id, url: getEditorUrl(put.id), type: "site" };
}

function resultLabel(result) {
  if (result.type === "template") return `Template "${result.id}" updated.`;
  return `Editor: ${result.url}`;
}

/**
 * Helper: get a TemplateBuilder loaded with site content from API.
 */
function getTemplateBuilder() {
  return require(path.join(getProjectDir(), "scripts/TemplateBuilder.js"));
}

/**
 * Fetch all components from API and build templateId → structure index.
 * This replaces the filesystem-based template loading in TemplateBuilder.
 */
async function loadTemplateIndex() {
  const data = await apiFetch("/api/v1/components?limit=500");
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

async function tbFromTarget(args) {
  const TemplateBuilder = getTemplateBuilder();
  const { targetId, targetType, flat } = await fetchForTarget(args);
  const tb = TemplateBuilder.fromNodes(flat, getProjectDir(), { slug: targetId });
  return { targetId, targetType, tb };
}

module.exports = {
  async create_template(args) {
    const TemplateBuilder = getTemplateBuilder();
    const tb = TemplateBuilder.fromAcme(getProjectDir(), {
      slug: args.slug || "new-site",
      title: args.title || "New Template",
      description: args.description || "",
      image: args.image || "",
      hidden: args.hidden === true,
      homePage: true,
    });
    // Stamp provenance on ROOT so the site knows where it came from
    stampRootSource(tb.nodes, {
      type: "base",
      template: "acme",
      createdAt: new Date().toISOString(),
    });
    const desc = typeof args.description === "string" ? args.description.trim() : "";
    if (desc && tb.nodes?.ROOT?.props) {
      tb.nodes.ROOT.props.designNotes = truncateDesignNotes(desc);
    }
    if (Array.isArray(args.tags) && args.tags.length && tb.nodes?.ROOT?.props) {
      tb.nodes.ROOT.props.designTags = normalizeDesignTags(args.tags);
    }
    // Save as a new site via API
    const data = await apiFetch("/api/v1/sites", {
      method: "POST",
      body: {
        content: tb.nodes,
        name: args.title || args.slug || "New Site",
        title: args.title,
        description: args.description,
      },
    });
    config.activeSite = { id: data.id, name: data.name, draftId: data.draftId };
    config.activeTemplate = null;
    return {
      content: [
        {
          type: "text",
          text: `Site created: ${data.id}\nEditor: ${getEditorUrl(data.id)}\nPreview: ${data.staticUrl}\n\nAuto-selected as active site. Next: set_theme, then add_block.`,
        },
      ],
    };
  },

  async set_theme(args) {
    const TemplateBuilder = getTemplateBuilder();
    const { preset, palette, darkPalette, styleGuide, fonts, jsonLd } = args;

    // If no existing target, create from acme base
    let hasTarget;
    try {
      getActiveTarget(args);
      hasTarget = true;
    } catch {
      hasTarget = false;
    }
    if (!hasTarget) {
      const result = await module.exports.create_template(args);
      return result;
    }

    const { targetId, targetType, tb } = await tbFromTarget(args);

    let resolvedPalette = parseMaybeJson(palette);
    let resolvedDarkPalette = parseMaybeJson(darkPalette);
    let resolvedStyleGuide = parseMaybeJson(styleGuide);
    let resolvedFonts = parseMaybeJson(fonts);
    if (preset) {
      const presetData = await apiFetch(`/api/v1/presets/${encodeURIComponent(preset)}`);
      const found = presetData.preset;
      if (!found)
        throw new Error(`Preset "${preset}" not found. Use list_presets to see available presets.`);
      if (!resolvedPalette) resolvedPalette = found.palette;
      if (!resolvedDarkPalette && found.darkPalette) resolvedDarkPalette = found.darkPalette;
      if (!resolvedStyleGuide) resolvedStyleGuide = found.styleGuide;
      if (!resolvedFonts) resolvedFonts = found.fonts;
    }

    tb.setTheme({
      palette: resolvedPalette,
      darkPalette: resolvedDarkPalette,
      styleGuide: resolvedStyleGuide,
      fonts: resolvedFonts,
      jsonLd: parseMaybeJson(jsonLd),
    });

    const result = await saveForTarget(targetId, targetType, tb.nodes);
    const presetMsg = preset ? ` (preset: ${preset})` : "";
    return {
      content: [{ type: "text", text: `Theme saved${presetMsg}.\n${resultLabel(result)}` }],
    };
  },

  async add_block(args) {
    const { templateId, contentOverrides, propOverrides, position, pageId } = args;
    const { targetId, targetType, tb } = await tbFromTarget(args);
    const templateIndex = await loadTemplateIndex();
    tb.setTemplateIndex(templateIndex);
    tb.addSection(templateId, {
      contentOverrides: parseMaybeJson(contentOverrides) || {},
      propOverrides: parseMaybeJson(propOverrides) || {},
      position,
      pageId,
    });
    const result = await saveForTarget(targetId, targetType, tb.nodes);
    return {
      content: [{ type: "text", text: `Block ${templateId} added.\n${resultLabel(result)}` }],
    };
  },

  async add_custom_block(args) {
    const { sectionRootId, nodes, parentNodeId, position } = args;
    const { targetId, targetType, tb } = await tbFromTarget(args);
    const nodeMap = parseMaybeJson(nodes);
    if (!nodeMap || typeof nodeMap !== "object") throw new Error("nodes must be an object map");

    // Validate & auto-fix nodes before image validation and save
    const validation = validateNodes(nodeMap, { autoFix: true, warnColors: true });
    const validationReport = formatValidationReport(validation);
    if (validation.errors.length > 0) {
      throw new Error(
        `Cannot add block — ${validation.errors.length} structural error(s):\n${validation.errors.join("\n")}\n\nFix these before saving.`
      );
    }

    const allImgUrls = collectAllImageUrls(nodeMap);
    if (allImgUrls.length > 0) {
      const failures = await validateImageUrls(allImgUrls.map(u => u.url));
      if (failures.length > 0) {
        const msg = failures
          .map(f => {
            const nodeRef = allImgUrls.find(u => u.url === f.url);
            return `  ${nodeRef?.nodeId || "?"}: ${f.url} → ${f.status}`;
          })
          .join("\n");
        throw new Error(
          `Image validation failed — these URLs are broken:\n${msg}\n\nFix the URLs and try again.`
        );
      }
    }
    tb.addCustomSection(sectionRootId, nodeMap, { parentNodeId, position });
    const result = await saveForTarget(targetId, targetType, tb.nodes);
    const reportSuffix = validationReport ? `\n\n---\n${validationReport}` : "";
    return {
      content: [
        {
          type: "text",
          text: `Custom section ${sectionRootId} added. (${allImgUrls.length} image URLs validated)\n${resultLabel(result)}${reportSuffix}`,
        },
      ],
    };
  },

  // Node-level tools — delegated to mcp-core
  update_node: delegatedNodes.update_node,
  delete_node: delegatedNodes.delete_node,
  insert_node: delegatedNodes.insert_node,
  list_site_nodes: delegatedNodes.list_site_nodes,
  search_site_nodes: delegatedNodes.search_site_nodes,
  set_integrations: delegatedNodes.set_integrations,
  set_redirects: delegatedNodes.set_redirects,
};
