const path = require('path');
const { getProjectDir, apiFetch, getActiveSiteId, getEditorUrl } = require('../config');
const { parseMaybeJson } = require('../helpers');

function getTemplateBuilder() {
  return require(path.join(getProjectDir(), 'scripts/TemplateBuilder.js'));
}

function slugify(s) {
  return String(s || 'node').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48) || 'node';
}

/**
 * Load components from API and build category index + reverse slug map.
 */
async function loadCategoryIndex() {
  const data = await apiFetch('/api/v1/components?limit=500');
  const components = data.components || [];
  const byCategory = {};
  const slugToTemplate = {};

  for (const comp of components) {
    const cat = comp.category || 'uncategorized';
    if (!byCategory[cat]) byCategory[cat] = { id: cat, name: cat, templates: [] };
    byCategory[cat].templates.push({ id: comp.slug, name: comp.name, visual: comp.visual });
    slugToTemplate[slugify(comp.slug)] = { categoryId: cat, templateId: comp.slug, name: comp.name, visual: comp.visual };
  }

  return { categories: Object.values(byCategory), slugToTemplate };
}

/**
 * Walk a section subtree and collect content by displayName for override mapping.
 */
function extractContentMap(nodes, rootId) {
  const map = {};
  const visit = (id) => {
    const node = nodes[id];
    if (!node) return;
    const label = node.custom?.displayName;
    const resolvedName = node.type?.resolvedName;
    if (label && resolvedName) {
      const entry = {};
      if (resolvedName === 'Text') {
        if (node.props?.text != null) entry.text = node.props.text;
        if (node.props?.tagName) entry.tagName = node.props.tagName;
      } else if (resolvedName === 'Button') {
        if (node.props?.text != null) entry.text = node.props.text;
        if (node.props?.url != null) entry.url = node.props.url;
        if (node.props?.icon) entry.icon = node.props.icon;
      } else if (resolvedName === 'Image') {
        if (node.props?.content != null) entry.content = node.props.content;
        if (node.props?.alt != null) entry.alt = node.props.alt;
        if (node.props?.src != null) entry.src = node.props.src;
      } else if (resolvedName === 'Form') {
        if (node.props?.formName != null) entry.formName = node.props.formName;
      }
      if (Object.keys(entry).length > 0) map[label] = entry;
    }
    for (const childId of node.nodes || []) visit(childId);
  };
  visit(rootId);
  return map;
}

module.exports = {
  async list_example_sections(args) {
    const TemplateBuilder = getTemplateBuilder();
    const siteId = getActiveSiteId(args);
    const data = await apiFetch(`/api/v1/sites/${encodeURIComponent(siteId)}`);
    if (!data.content) throw new Error('Site has no content.');
    const nodes = data.content;
    const sections = TemplateBuilder.listSections(nodes, args.pageId);
    if (sections.length === 0) {
      return { content: [{ type: 'text', text: `No sections found. The page container may be empty.` }] };
    }
    const lines = sections.map((s, i) =>
      `${i + 1}. **${s.id}** — "${s.displayName}" (${s.type}, ${s.childCount} descendants)`
    );
    return {
      content: [{
        type: 'text',
        text: `# Sections in site ${siteId}\n\nUse these IDs with extract_section(sectionRootId).\n\n${lines.join('\n')}`,
      }],
    };
  },

  async extract_section(args) {
    const TemplateBuilder = getTemplateBuilder();
    const { sectionRootId, templatize } = args;
    const siteId = getActiveSiteId(args);
    const data = await apiFetch(`/api/v1/sites/${encodeURIComponent(siteId)}`);
    if (!data.content) throw new Error('Site has no content.');
    const nodes = data.content;
    const structure = TemplateBuilder.extractSection(nodes, sectionRootId, { templatize: templatize === true });
    return {
      content: [{
        type: 'text',
        text: `# Extracted Section: ${sectionRootId}\n\nPass this structure to save_as_section_template to save it as a reusable template.\n\n\`\`\`json\n${JSON.stringify(structure, null, 2)}\n\`\`\``,
      }],
    };
  },

  async shuffle_section(args) {
    const TemplateBuilder = getTemplateBuilder();
    const { sectionRootId, targetTemplateId, pageId } = args;
    const siteId = getActiveSiteId(args);

    // Fetch site
    const data = await apiFetch(`/api/v1/sites/${encodeURIComponent(siteId)}`);
    if (!data.content) throw new Error('Site has no content.');
    const nodes = JSON.parse(JSON.stringify(data.content));

    const sectionNode = nodes[sectionRootId];
    if (!sectionNode) throw new Error(`Section "${sectionRootId}" not found.`);

    // Find the section's parent and position
    const parentId = sectionNode.parent || pageId || 'page_home';
    const parentNode = nodes[parentId];
    if (!parentNode) throw new Error(`Parent node "${parentId}" not found.`);
    const position = (parentNode.nodes || []).indexOf(sectionRootId);
    if (position === -1) throw new Error(`Section "${sectionRootId}" not found in parent "${parentId}" nodes array.`);

    // Identify category by reverse-looking up the template slug from the node ID
    const { categories, slugToTemplate } = await loadCategoryIndex();
    let currentTemplateId = null;
    let categoryId = null;

    // Try ID-based detection: sec{N}_{slugifiedTemplateId}_{localSeq}
    const idMatch = sectionRootId.match(/^sec\d+_(.+)_\d+$/);
    if (idMatch) {
      const slugCandidate = idMatch[1];
      const entry = slugToTemplate[slugCandidate];
      if (entry) {
        currentTemplateId = entry.templateId;
        categoryId = entry.categoryId;
      }
    }

    if (!categoryId) {
      throw new Error(
        `Could not identify the template category for section "${sectionRootId}". ` +
        `This section may have been created via add_custom_section or manual editing. ` +
        `Tip: use list_sections to browse categories, then delete_node + add_section manually.`
      );
    }

    // Get all templates in the same category
    const cat = categories.find(c => c.id === categoryId);
    const alternatives = (cat?.templates || []).filter(t => t.id !== currentTemplateId);
    if (alternatives.length === 0) {
      throw new Error(`No alternative templates in category "${categoryId}". Only one template exists: ${currentTemplateId}.`);
    }

    // Pick target
    let chosenId;
    if (targetTemplateId) {
      if (!alternatives.some(t => t.id === targetTemplateId)) {
        const available = alternatives.map(t => t.id).join(', ');
        throw new Error(`Template "${targetTemplateId}" is not in category "${categoryId}" or is the current template. Available: ${available}`);
      }
      chosenId = targetTemplateId;
    } else {
      chosenId = alternatives[Math.floor(Math.random() * alternatives.length)].id;
    }

    // Extract content from old section
    const contentOverrides = extractContentMap(nodes, sectionRootId);

    // Delete old section subtree
    const deleteSubtree = (id) => {
      const node = nodes[id];
      if (!node) return;
      for (const child of [...(node.nodes || [])]) deleteSubtree(child);
      delete nodes[id];
    };
    parentNode.nodes = parentNode.nodes.filter(id => id !== sectionRootId);
    deleteSubtree(sectionRootId);

    // Add new section at same position via TemplateBuilder
    const tb = TemplateBuilder.fromNodes(nodes, getProjectDir(), { slug: siteId });
    // Load component structures from API for template lookup
    const compData = await apiFetch(`/api/v1/components/${encodeURIComponent(chosenId)}`);
    if (!compData.component?.structure) throw new Error(`Component "${chosenId}" has no structure.`);
    tb.setTemplateIndex({ [chosenId]: compData.component.structure });
    tb.addSection(chosenId, { contentOverrides, position, pageId: parentId });

    // Save
    const body = { content: tb.nodes };
    const put = await apiFetch(`/api/v1/sites/${encodeURIComponent(siteId)}`, { method: 'PUT', body });
    const url = getEditorUrl(put.id);

    // Build alternatives list for the response
    const remaining = alternatives.filter(t => t.id !== chosenId);
    const altList = remaining.length > 0
      ? `\n\nOther alternatives you can try:\n${remaining.map(t => `- **${t.id}** — ${t.visual || t.name || '(no description)'}`).join('\n')}`
      : '';
    const mappedCount = Object.keys(contentOverrides).length;

    return {
      content: [{
        type: 'text',
        text: `Shuffled: **${currentTemplateId}** → **${chosenId}** (category: ${categoryId})\n${mappedCount} content override(s) preserved by displayName.\nEditor: ${url}${altList}`,
      }],
    };
  },

  async save_as_section_template(args) {
    const { category, templateId, name: tplName, visual, tags, structure } = args;

    const resolvedStructure = parseMaybeJson(structure) || structure;
    if (!resolvedStructure || typeof resolvedStructure !== 'object') {
      throw new Error('structure is required and must be a valid object.');
    }

    const data = await apiFetch('/api/v1/components', {
      method: 'POST',
      body: {
        name: tplName || templateId,
        slug: templateId,
        category: category || 'uncategorized',
        visual: visual || '',
        tags: parseMaybeJson(tags) || tags || [],
        structure: resolvedStructure,
        isPublic: true,
      },
    });

    return {
      content: [{
        type: 'text',
        text: `Template "${templateId}" saved as component (category: ${category}). Use add_section(templateId: "${templateId}") to use it.`,
      }],
    };
  },
};
