/**
 * Where a local `filePath` upload may read from.
 *
 * The path comes from the model, and what's uploaded ends up on a public site,
 * so the MCP server reads only inside one folder and never a hidden file.
 */

const { realpath } = require("node:fs/promises");
const { isAbsolute, parse, relative, resolve, sep } = require("node:path");

/**
 * The folder local uploads may come from: `PAGEHUB_UPLOAD_ROOT` when set,
 * otherwise the directory the MCP server was started in. A server started at
 * the filesystem root (some desktop clients do this) has no meaningful
 * folder, so it must be given one explicitly.
 */
async function uploadRoot() {
  const configured = process.env.PAGEHUB_UPLOAD_ROOT;
  const root = await realpath(resolve(configured || process.cwd())).catch(() => null);
  if (!root) {
    throw new Error(`PAGEHUB_UPLOAD_ROOT (${configured}) doesn't exist. Point it at the folder your files are in.`);
  }
  if (root === parse(root).root) {
    throw new Error(
      "Local uploads need a folder to read from. Set PAGEHUB_UPLOAD_ROOT in this MCP server's env " +
        "to the folder your files are in, then restart it."
    );
  }
  return root;
}

/**
 * Resolve a caller-supplied path to a real file inside the upload root.
 * Symlinks are followed before the check, so a link can't point back out.
 * Any dot-segment below the root (`.ssh`, `.env`, `.git/…`) is refused —
 * that's where credentials live, and nothing on a website comes from there.
 */
async function resolveUploadPath(rawPath) {
  const root = await uploadRoot();
  const expanded = String(rawPath).replace(/^~(?=\/|$)/, process.env.HOME || "~");
  const abs = resolve(root, expanded);
  const real = await realpath(abs).catch(() => null);
  if (!real) throw new Error(`File not found: ${abs}`);

  const rel = relative(root, real);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(
      `${abs} is outside the upload folder (${root}). Move it there, or set PAGEHUB_UPLOAD_ROOT to its folder.`
    );
  }
  if (rel.split(sep).some(part => part.startsWith("."))) {
    throw new Error(`${abs} is a hidden file or inside a hidden folder, which can't be uploaded.`);
  }
  return real;
}

module.exports = { uploadRoot, resolveUploadPath };
