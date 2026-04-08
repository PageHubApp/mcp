// Re-export shared helpers from mcp-core
const {
  parseMaybeJson,
  applyNodePatches,
  normalizeNodePatchArgs,
} = require('@pagehub/mcp-core');

// ── Image URL validation (MCP-only — uses fetch HEAD) ──

function extractImageUrls(props, resolvedName) {
  const urls = [];
  if (!props) return urls;
  if (resolvedName === 'Image' && props.content && typeof props.content === 'string') {
    if (props.type === 'url' || (!props.type && props.content.startsWith('http'))) {
      urls.push(props.content);
    }
  }
  if (props.backgroundImage && typeof props.backgroundImage === 'string' && props.backgroundImage.startsWith('http')) {
    urls.push(props.backgroundImage);
  }
  return urls;
}

async function validateImageUrls(urls) {
  const failures = [];
  for (const url of urls) {
    try {
      const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
      if (!resp.ok) {
        failures.push({ url, status: resp.status });
      }
    } catch (e) {
      failures.push({ url, status: `error: ${e.message}` });
    }
  }
  return failures;
}

function collectAllImageUrls(nodes) {
  const urls = [];
  for (const [id, node] of Object.entries(nodes)) {
    const resolved = node.type?.resolvedName;
    const found = extractImageUrls(node.props, resolved);
    for (const url of found) urls.push({ nodeId: id, url });
  }
  return urls;
}

module.exports = {
  parseMaybeJson,
  extractImageUrls,
  validateImageUrls,
  collectAllImageUrls,
  applyNodePatches,
  normalizeNodePatchArgs,
};
