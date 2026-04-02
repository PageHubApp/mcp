const fs = require('fs');

const WCAG_TAGS = {
  A: ['wcag2a', 'wcag21a'],
  AA: ['wcag2aa', 'wcag21aa', 'wcag22aa', 'wcag2a', 'wcag21a'],
  AAA: ['wcag2aaa', 'wcag21aaa', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'wcag2a', 'wcag21a'],
};

function formatResults(results, source, level) {
  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    help: v.help,
    helpUrl: v.helpUrl,
    wcagTags: v.tags.filter((t) => t.startsWith('wcag')),
    nodes: v.nodes.map((n) => ({
      html: n.html.slice(0, 300),
      target: n.target,
      failureSummary: n.failureSummary,
    })),
  }));

  return {
    summary: {
      source,
      level,
      engine: results._engine || 'unknown',
      totalViolations: violations.length,
      bySeverity: {
        critical: violations.filter((v) => v.impact === 'critical').length,
        serious: violations.filter((v) => v.impact === 'serious').length,
        moderate: violations.filter((v) => v.impact === 'moderate').length,
        minor: violations.filter((v) => v.impact === 'minor').length,
      },
      passes: results.passes.length,
      incomplete: results.incomplete.length,
    },
    violations,
  };
}

// ── Playwright (full audit — contrast, CSS, real render) ──

async function auditWithPlaywright(url, html, tags) {
  const { chromium } = require('playwright-core');
  const { AxeBuilder } = require('@axe-core/playwright');

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    if (url) {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    } else {
      await page.setContent(html, { waitUntil: 'networkidle', timeout: 15000 });
    }

    const results = await new AxeBuilder({ page })
      .withTags(tags)
      .analyze();

    results._engine = 'playwright';
    return results;
  } finally {
    await browser.close();
  }
}

// ── jsdom fallback (structural only — no contrast/CSS) ──

async function auditWithJsdom(url, html, tags) {
  const { JSDOM } = require('jsdom');

  let markup = html;
  if (url) {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PageHub-A11y-Audit/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    markup = await res.text();
  }

  const dom = new JSDOM(markup, { url: url || 'http://localhost', runScripts: 'outside-only' });
  try {
    // Load axe-core into jsdom — eval() with runScripts:'outside-only' is the
    // official pattern (see github.com/dequelabs/axe-core/tree/develop/doc/examples/jsdom).
    // The source is always the trusted axe-core bundle from node_modules, never user input.
    const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
    dom.window.eval(axeSource);
    const results = await dom.window.axe.run(dom.window.document, {
      runOnly: { type: 'tag', values: tags },
    });
    results._engine = 'jsdom (no contrast/CSS — install playwright-core + chromium for full audit)';
    return results;
  } finally {
    dom.window.close();
  }
}

// ── Check if Playwright + a browser is available ──

function hasPlaywright() {
  try {
    require('playwright-core');
    require('@axe-core/playwright');
    return true;
  } catch {
    return false;
  }
}

// ── MCP handler ──

async function audit_accessibility({ url, html, level = 'AA' }) {
  if (!url && !html) {
    return { isError: true, content: [{ type: 'text', text: 'Provide either "url" or "html".' }] };
  }

  const normalLevel = level.toUpperCase();
  const tags = WCAG_TAGS[normalLevel];
  if (!tags) {
    return { isError: true, content: [{ type: 'text', text: `Invalid level "${level}". Use A, AA, or AAA.` }] };
  }

  try {
    let results;
    if (hasPlaywright()) {
      try {
        results = await auditWithPlaywright(url, html, tags);
      } catch (pwErr) {
        // Browser not installed — fall back to jsdom
        if (pwErr.message.includes('Executable') || pwErr.message.includes('browser')) {
          results = await auditWithJsdom(url, html, tags);
        } else {
          throw pwErr;
        }
      }
    } else {
      results = await auditWithJsdom(url, html, tags);
    }

    const output = formatResults(results, url || '(raw html)', normalLevel);
    return { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }] };
  } catch (err) {
    return { isError: true, content: [{ type: 'text', text: `Audit error: ${err.message}` }] };
  }
}

module.exports = { audit_accessibility };
