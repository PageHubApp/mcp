/**
 * Local `import_site({ filePath })`: zip → presign → PUT → start → status,
 * against a stubbed fetch (no network, no PageHub API).
 *
 *   node --test packages/mcp/src/handlers/import.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, mkdir, writeFile, rm } = require("node:fs/promises");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const JSZip = require("jszip");

process.env.PAGEHUB_API_KEY = "ph_test";
process.env.PAGEHUB_API_BASE_URL = "http://pagehub.test";
const { import_site } = require("./import");

const KEY = "imports/u1/abc/file.zip";

function stubFetch(statusBody) {
  const calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method || "GET", headers: opts.headers || {}, body: opts.body });
    const json = body => new Response(JSON.stringify(body), { status: 200 });
    if (url.endsWith("/api/import/presign")) {
      return json({ key: KEY, uploadUrl: "https://r2.test/put?sig=1", contentType: "application/octet-stream" });
    }
    if (url.startsWith("https://r2.test/")) return new Response("", { status: 200 });
    if (url.endsWith("/api/import")) return json({ importId: "imp1" });
    if (url.includes("/api/import/status")) return json(statusBody);
    return new Response("{}", { status: 404 });
  };
  return calls;
}

const READY = {
  importId: "imp1",
  source: "html",
  status: "ready",
  progress: { pagesTotal: 2, pagesDone: 2, mediaTotal: 0, mediaDone: 0, phase: "Done" },
  warnings: ["about.html links to a missing file"],
  skippedMedia: [],
  siteId: "site1",
  draftId: "d1",
  previewUrl: "https://d1.preview.pagehub.test/view/d1",
  error: null,
  result: { redirects: [{ from: "/about.html", to: "/about" }] },
};

async function withRoot(run) {
  const root = await mkdtemp(join(tmpdir(), "ph-import-"));
  await mkdir(join(root, "dist"));
  await writeFile(join(root, "dist", "index.html"), "<h1>Home</h1>");
  await writeFile(join(root, "dist", "about.html"), "<h1>About</h1>");
  await writeFile(join(root, "notes.txt"), "x");
  const prev = process.env.PAGEHUB_UPLOAD_ROOT;
  process.env.PAGEHUB_UPLOAD_ROOT = root;
  try {
    await run(root);
  } finally {
    process.env.PAGEHUB_UPLOAD_ROOT = prev;
    await rm(root, { recursive: true, force: true });
  }
}

test("a folder is zipped, PUT to the signed URL and imported", () =>
  withRoot(async () => {
    const calls = stubFetch(READY);
    const res = await import_site({ filePath: "dist", name: "My site" });

    const [presign, put, start, status] = calls;
    assert.equal(presign.url, "http://pagehub.test/api/import/presign");
    assert.equal(presign.headers.Authorization, "Bearer ph_test");
    const presignBody = JSON.parse(presign.body);
    assert.deepEqual({ ...presignBody, size: typeof presignBody.size }, { source: "html", filename: "site.zip", size: "number" });

    assert.equal(put.method, "PUT");
    assert.equal(put.headers["Content-Type"], "application/octet-stream");
    assert.equal(put.body.length, presignBody.size);
    const names = Object.keys((await JSZip.loadAsync(put.body)).files).sort();
    assert.deepEqual(names, ["about.html", "index.html"]);

    assert.deepEqual(JSON.parse(start.body), {
      source: "html",
      fileKeys: [KEY],
      options: { siteName: "My site" },
      autoConfirm: true,
    });
    assert.equal(status.url, "http://pagehub.test/api/import/status?importId=imp1");

    const text = res.content[0].text;
    assert.ok(!res.isError);
    assert.match(text, /Editor: http:\/\/pagehub\.test\/dashboard\/sites\/site1\/design/);
    assert.match(text, /Preview: https:\/\/d1\.preview\.pagehub\.test\/view\/d1/, "the preview link is the server's previewUrl, never built from the API origin");
    assert.match(text, /Redirects from the old page addresses: 1/);
    assert.match(text, /about\.html links to a missing file/);
  }));

test("a failed import comes back as an error with the reason", () =>
  withRoot(async () => {
    stubFetch({ ...READY, status: "failed", siteId: null, error: "index.html is drawn by JavaScript" });
    const res = await import_site({ filePath: "dist" });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /Error: index\.html is drawn by JavaScript/);
  }));

test("refuses a plain file, and filePath mixed with another mode", () =>
  withRoot(async () => {
    stubFetch(READY);
    await assert.rejects(import_site({ filePath: "notes.txt" }), /site folder or a \.zip/);
    await assert.rejects(import_site({ filePath: "dist", size: 10 }), /Pass one of/);
  }));

test("without filePath the size mode returns the upload URL and curl line", async () => {
  stubFetch(READY);
  const res = await import_site({ size: 1234 });
  const text = res.content[0].text;
  assert.match(text, /uploadKey: imports\/u1\/abc\/file\.zip/);
  assert.match(
    text,
    /curl -sS -X PUT -H "Content-Type: application\/octet-stream" --data-binary @site\.zip "https:\/\/r2\.test\/put\?sig=1"/
  );
});

test("files mode starts an inline import; no mode at all is refused", async () => {
  const calls = stubFetch(READY);
  const files = [{ path: "index.html", content: "<h1>Hi</h1>" }];
  const res = await import_site({ files, name: "Inline" });
  const start = calls.find(c => c.url.endsWith("/api/import"));
  assert.deepEqual(JSON.parse(start.body), {
    source: "html",
    inlineFiles: files,
    options: { siteName: "Inline" },
    autoConfirm: true,
  });
  assert.match(res.content[0].text, /importId: imp1/);
  await assert.rejects(import_site({}), /Pass one of filePath, size, uploadKey or files/);
});
