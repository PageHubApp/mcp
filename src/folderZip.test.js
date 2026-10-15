/**
 * Local site folders zip with the server's own rules: no hidden files, no
 * node_modules, no links out of the folder, within the import limits.
 *
 *   node --test packages/mcp/src/folderZip.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, mkdir, writeFile, symlink, rm } = require("node:fs/promises");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const JSZip = require("jszip");
const { zipFolder } = require("./folderZip");

async function withSite(run) {
  const base = await mkdtemp(join(tmpdir(), "ph-zip-"));
  const site = join(base, "site");
  await mkdir(join(site, "css"), { recursive: true });
  await mkdir(join(site, ".git"), { recursive: true });
  await mkdir(join(site, "node_modules", "x"), { recursive: true });
  await writeFile(join(site, "index.html"), "<h1>Home</h1>");
  await writeFile(join(site, "about.html"), "<h1>About</h1>");
  await writeFile(join(site, "css", "site.css"), "body{}");
  await writeFile(join(site, ".env"), "SECRET=1");
  await writeFile(join(site, ".git", "config"), "[core]");
  await writeFile(join(site, "node_modules", "x", "i.js"), "x");
  await writeFile(join(base, "outside.txt"), "nope");
  try {
    await run({ base, site });
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}

const entries = async buffer =>
  Object.values((await JSZip.loadAsync(buffer)).files)
    .filter(f => !f.dir)
    .map(f => f.name)
    .sort();

test("zips the site with POSIX paths, leaving out hidden files and node_modules", () =>
  withSite(async ({ site }) => {
    const { buffer, fileCount } = await zipFolder(site);
    assert.equal(fileCount, 3);
    assert.deepEqual(await entries(buffer), ["about.html", "css/site.css", "index.html"]);
    const zip = await JSZip.loadAsync(buffer);
    assert.equal(await zip.file("index.html").async("string"), "<h1>Home</h1>");
  }));

test("follows a link inside the folder, refuses one that points out", () =>
  withSite(async ({ base, site }) => {
    await symlink(join(site, "css", "site.css"), join(site, "copy.css"));
    assert.ok((await entries((await zipFolder(site)).buffer)).includes("copy.css"));

    await symlink(join(base, "outside.txt"), join(site, "leak.txt"));
    await assert.rejects(zipFolder(site), /link to something outside/);
  }));

test("refuses a folder over the file or byte limit", () =>
  withSite(async ({ site }) => {
    await assert.rejects(zipFolder(site, { maxFiles: 2, maxBytes: 1e9 }), /more than 2 files/);
    await assert.rejects(zipFolder(site, { maxFiles: 100, maxBytes: 10 }), /built site folder/);
  }));

test("refuses a folder with no HTML pages", () =>
  withSite(async ({ site }) => {
    await assert.rejects(zipFolder(join(site, "css")), /has no \.html files/);
  }));
