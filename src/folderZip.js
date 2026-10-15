/**
 * Zip a local site folder for `import_site({ filePath })`.
 *
 * Same rules as the server's archive reader, applied before anything leaves
 * the machine: hidden files/folders (`.git`, `.env`) and `node_modules` are
 * left out, a symlink may only point inside the folder, and the folder must
 * stay within the import limits (2,000 files, 50 MB).
 */

const { lstat, readdir, readFile, realpath, stat } = require("node:fs/promises");
const { join, relative, sep, isAbsolute } = require("node:path");
const JSZip = require("jszip");

const FOLDER_LIMITS = { maxFiles: 2000, maxBytes: 50 * 1024 * 1024 };

const skipName = name => name.startsWith(".") || name === "node_modules";

function inside(root, real) {
  const rel = relative(root, real);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/**
 * @param {string} absDir - Real path of the folder (already confined by resolveUploadPath).
 * @param {{ maxFiles?: number, maxBytes?: number }} [limits]
 * @returns {Promise<{ buffer: Buffer, fileCount: number, totalBytes: number }>}
 */
async function zipFolder(absDir, limits = FOLDER_LIMITS) {
  const root = await realpath(absDir);
  const files = []; // [relPosixPath, absPath]
  const visited = new Set();
  let totalBytes = 0;

  const tooBig = () =>
    new Error(
      `${root} has more than ${limits.maxFiles.toLocaleString("en-US")} files or ` +
        `${Math.round(limits.maxBytes / 1048576)} MB. Point filePath at the built site folder ` +
        "(like dist/ or out/), not the whole project."
    );

  async function walk(dir) {
    const real = await realpath(dir);
    if (visited.has(real)) return;
    visited.add(real);
    const names = (await readdir(dir)).sort();
    for (const name of names) {
      if (skipName(name)) continue;
      const abs = join(dir, name);
      let info = await lstat(abs);
      if (info.isSymbolicLink()) {
        const target = await realpath(abs).catch(() => null);
        if (!target || !inside(root, target)) {
          throw new Error(`${abs} is a link to something outside ${root}. Copy the file into the folder instead.`);
        }
        info = await stat(target);
      }
      if (info.isDirectory()) {
        await walk(abs);
      } else if (info.isFile()) {
        totalBytes += info.size;
        files.push([relative(root, abs).split(sep).join("/"), abs]);
        if (files.length > limits.maxFiles || totalBytes > limits.maxBytes) throw tooBig();
      }
    }
  }
  await walk(root);

  if (!files.some(([p]) => /\.html?$/i.test(p))) {
    throw new Error(
      `${root} has no .html files. Point filePath at the folder that holds index.html ` +
        "(for a React/Vite/Next build, the output folder after running the build)."
    );
  }

  const zip = new JSZip();
  for (const [rel, abs] of files) zip.file(rel, await readFile(abs));
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { buffer, fileCount: files.length, totalBytes };
}

module.exports = { zipFolder, FOLDER_LIMITS };
