/**
 * Local HTML site import — `import_site({ filePath })`.
 *
 * The stdio server can read the user's disk, so it does the upload-link dance
 * itself instead of sending bytes through the model: zip the folder (or read
 * the .zip) → presign a private upload → PUT the bytes straight to R2 → start
 * the import → poll until the new draft site is ready. Without `filePath` the
 * call goes to mcp-core's hosted handler (size / uploadKey / files modes).
 *
 * Reads are confined to the upload folder (`../uploadPath.js`), like
 * `upload_image({ filePath })`.
 */

const { readFile, stat } = require("node:fs/promises");
const { extname } = require("node:path");
const { apiFetch, formatImportStatus, presignImport, startImport } = require("@pagehub/mcp-core");
const coreHandlers = require("@pagehub/mcp-core/handlers/remote");
const { delegateHandlers, withContext } = require("../config");
const { zipFolder } = require("../folderZip");
const { resolveUploadPath } = require("../uploadPath");

const delegated = delegateHandlers(coreHandlers);

const DONE = new Set(["ready", "failed", "review"]);

function fetchStatus(importId) {
  return apiFetch(`/api/import/status?importId=${encodeURIComponent(importId)}`);
}

/** Zip bytes for a folder or a .zip at `rawPath`. */
async function readSiteZip(rawPath) {
  const abs = await resolveUploadPath(rawPath);
  const info = await stat(abs);
  if (info.isDirectory()) return (await zipFolder(abs)).buffer;
  if (info.isFile() && extname(abs).toLowerCase() === ".zip") return readFile(abs);
  throw new Error("Point filePath at the site folder or a .zip.");
}

const POLL_MS = 3000;
const TIMEOUT_MS = 90_000;

/** @param {object} args - { filePath, name? } */
async function importLocalSite(args) {
  const bytes = await readSiteZip(args.filePath);
  const { key, uploadUrl, contentType } = await presignImport(bytes.length);

  const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: bytes });
  if (!put.ok) {
    const detail = (await put.text().catch(() => "")).slice(0, 300);
    throw new Error(`The zip didn't upload (HTTP ${put.status}). Try the import again.${detail ? `\n${detail}` : ""}`);
  }

  const { importId } = await startImport({ uploadKey: key, name: args.name });
  const deadline = Date.now() + TIMEOUT_MS;
  let status = await fetchStatus(importId);
  while (!DONE.has(status.status) && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_MS));
    status = await fetchStatus(importId);
  }

  const text = formatImportStatus(status);
  if (status.status === "failed") return { isError: true, content: [{ type: "text", text }] };
  return { content: [{ type: "text", text }] };
}

module.exports = {
  async import_site(args = {}) {
    if (args.filePath === undefined || args.filePath === null) return delegated.import_site(args);
    if (["size", "uploadKey", "files"].some(k => args[k] !== undefined && args[k] !== null)) {
      throw new Error("Pass one of filePath, size, uploadKey or files.");
    }
    return withContext(() => importLocalSite(args));
  },

  get_import_status: delegated.get_import_status,
};
