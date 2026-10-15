/**
 * Local uploads stay inside the upload folder and never read hidden files.
 *
 *   node --test packages/mcp/src/uploadPath.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, mkdir, writeFile, symlink, rm } = require("node:fs/promises");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { resolveUploadPath } = require("./uploadPath");

async function withRoot(run) {
  const base = await mkdtemp(join(tmpdir(), "ph-upload-"));
  const root = join(base, "site");
  const outside = join(base, "outside");
  await mkdir(join(root, "photos"), { recursive: true });
  await mkdir(join(root, ".ssh"), { recursive: true });
  await mkdir(outside, { recursive: true });
  await writeFile(join(root, "photos", "a.jpg"), "x");
  await writeFile(join(root, ".env"), "SECRET=1");
  await writeFile(join(root, ".ssh", "id_rsa.png"), "key");
  await writeFile(join(outside, "b.jpg"), "x");
  await symlink(join(outside, "b.jpg"), join(root, "photos", "link.jpg"));
  const previous = process.env.PAGEHUB_UPLOAD_ROOT;
  process.env.PAGEHUB_UPLOAD_ROOT = root;
  try {
    await run({ root, outside });
  } finally {
    if (previous === undefined) delete process.env.PAGEHUB_UPLOAD_ROOT;
    else process.env.PAGEHUB_UPLOAD_ROOT = previous;
    await rm(base, { recursive: true, force: true });
  }
}

test("a file inside the root resolves, relative or absolute", () =>
  withRoot(async ({ root }) => {
    assert.match(await resolveUploadPath("photos/a.jpg"), /photos[/\\]a\.jpg$/);
    assert.match(await resolveUploadPath(join(root, "photos", "a.jpg")), /photos[/\\]a\.jpg$/);
  }));

test("paths outside the root are refused, including via ../ and symlinks", () =>
  withRoot(async ({ outside }) => {
    await assert.rejects(resolveUploadPath(join(outside, "b.jpg")), /outside the upload folder/);
    await assert.rejects(resolveUploadPath("../outside/b.jpg"), /outside the upload folder/);
    await assert.rejects(resolveUploadPath("photos/link.jpg"), /outside the upload folder/);
  }));

test("hidden files and anything under a hidden folder are refused", () =>
  withRoot(async () => {
    await assert.rejects(resolveUploadPath(".env"), /hidden/);
    await assert.rejects(resolveUploadPath(".ssh/id_rsa.png"), /hidden/);
  }));

test("a missing file says so", () =>
  withRoot(async () => {
    await assert.rejects(resolveUploadPath("photos/nope.jpg"), /File not found/);
  }));

test("an upload root at the filesystem root is refused", async () => {
  const previous = process.env.PAGEHUB_UPLOAD_ROOT;
  process.env.PAGEHUB_UPLOAD_ROOT = "/";
  try {
    await assert.rejects(resolveUploadPath("etc/hosts"), /PAGEHUB_UPLOAD_ROOT/);
  } finally {
    if (previous === undefined) delete process.env.PAGEHUB_UPLOAD_ROOT;
    else process.env.PAGEHUB_UPLOAD_ROOT = previous;
  }
});
