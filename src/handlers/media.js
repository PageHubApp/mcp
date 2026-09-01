/**
 * Local-file media uploads — `upload_image` / `upload_file` with `filePath`.
 *
 * This server runs over stdio on the user's own machine, so it can read their
 * disk directly. That matters: without it the only way to get a local photo
 * into a site is to base64 it through the model's context (a 1 MB photo is
 * ~350k tokens), which is why uploading felt broken for anything real.
 *
 * `filePath` lives here rather than in mcp-core because mcp-core also backs the
 * hosted agent, where "the disk" is PageHub's server. The core handler rejects
 * `filePath` explicitly for that reason; anything without one delegates
 * straight through to it.
 */

const { readFile, stat } = require("node:fs/promises");
const { basename, extname, resolve } = require("node:path");
const { uploadBytesToSite, formatUploadResult } = require("@pagehub/mcp-core");
const { config, getActiveTarget, delegateHandlers, runWithContext } = require("../config");
const coreHandlers = require("@pagehub/mcp-core/handlers/remote");

const delegated = delegateHandlers(coreHandlers);

/**
 * mcp-core's `apiFetch` reads the API key off AsyncLocalStorage, which only
 * `delegateHandlers` seeds. Handlers written here have to seed it themselves
 * before calling into core.
 */
function withContext(fn) {
  return runWithContext(
    {
      apiKey: config.apiKey,
      apiBaseUrl: config.apiBaseUrl,
      activeSite: config.activeSite,
      activeTemplate: config.activeTemplate,
    },
    fn
  );
}

/** Extension → MIME. Covers every type `allowedMediaTypes` permits. */
const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
};

const IMAGE_EXTS = Object.entries(MIME_BY_EXT)
  .filter(([, mime]) => mime.startsWith("image/"))
  .map(([ext]) => ext);

/**
 * `sharp` is an optional dependency — a heavy native binary we don't want to
 * force on everyone installing the MCP. With it, local images get the same
 * treatment the browser editor gives them (EXIF rotate, AVIF/HEIC → JPEG,
 * downscale past 2680px) before they leave the machine. Without it, images
 * upload as-is and the caller gets a precise error if Cloudflare refuses them.
 */
function loadSharp() {
  try {
    return require("sharp");
  } catch {
    return null;
  }
}

const MAX_WIDTH = 2680;
const QUALITY = 82;
/** Cloudflare Images refuses a direct_upload over this, on every plan. */
const CF_IMAGES_MAX_BYTES = 10 * 1024 * 1024;
const TRANSCODE_TYPES = new Set(["image/avif", "image/heic", "image/heif"]);

async function prepareLocalImage(bytes, contentType, displayName) {
  if (!contentType.startsWith("image/") || contentType === "image/svg+xml") {
    return { bytes, contentType, width: null, height: null };
  }

  const sharp = loadSharp();
  if (!sharp) {
    // Say exactly what to do instead of letting Cloudflare answer with a 400.
    if (TRANSCODE_TYPES.has(contentType)) {
      throw new Error(
        `${displayName} is ${contentType}, which Cloudflare Images rejects. ` +
          "Install sharp in the MCP server (npm i sharp) to convert it automatically, " +
          "or convert it to JPEG/PNG first."
      );
    }
    if (bytes.length > CF_IMAGES_MAX_BYTES) {
      throw new Error(
        `${displayName} is ${(bytes.length / 1048576).toFixed(1)} MB — over Cloudflare's 10 MB image ceiling. ` +
          "Install sharp in the MCP server (npm i sharp) to downscale it automatically, or resize it first."
      );
    }
    return { bytes, contentType, width: null, height: null };
  }

  let meta;
  try {
    meta = await sharp(bytes).metadata();
  } catch {
    return { bytes, contentType, width: null, height: null };
  }

  const mustTranscode = TRANSCODE_TYPES.has(contentType);
  const tooWide = Number.isFinite(meta.width) && meta.width > MAX_WIDTH;
  // Re-encode an oversized file even at an acceptable width — JPEG quality 82
  // is what brings a 14 MB export under Cloudflare's ceiling.
  const tooBig = bytes.length > CF_IMAGES_MAX_BYTES;
  if (!mustTranscode && !tooWide && !tooBig) {
    return { bytes, contentType, width: meta.width ?? null, height: meta.height ?? null };
  }

  // `.rotate()` bakes EXIF orientation into the pixels — the CDN serves
  // stripped bytes, so skipping it uploads sideways phone shots.
  let pipeline = sharp(bytes).rotate();
  if (tooWide) pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });

  // Keep PNG/WebP in format so transparency survives; everything else → JPEG.
  let outType = "image/jpeg";
  if (!mustTranscode && contentType === "image/png") outType = "image/png";
  if (!mustTranscode && contentType === "image/webp") outType = "image/webp";

  if (outType === "image/png") pipeline = pipeline.png();
  else if (outType === "image/webp") pipeline = pipeline.webp({ quality: QUALITY });
  else pipeline = pipeline.jpeg({ quality: QUALITY, mozjpeg: true });

  const out = await pipeline.toBuffer({ resolveWithObject: true });
  return {
    bytes: out.data,
    contentType: outType,
    width: out.info.width,
    height: out.info.height,
    note: `${meta.width}x${meta.height} ${contentType} → ${out.info.width}x${out.info.height} ${outType}`,
  };
}

/** Normalize `filePath` (string, array, or JSON-array string) to a path list. */
function toPathList(filePath) {
  if (Array.isArray(filePath)) return filePath.map(String);
  const s = String(filePath).trim();
  if (s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // Not JSON — fall through and treat it as a single literal path.
    }
  }
  return [s];
}

async function uploadOneFile(siteId, rawPath, restrictToImages) {
  const abs = resolve(String(rawPath).replace(/^~(?=\/)/, process.env.HOME || "~"));
  const name = basename(abs);
  const ext = extname(abs).toLowerCase();

  let info;
  try {
    info = await stat(abs);
  } catch {
    throw new Error(`File not found: ${abs}`);
  }
  if (info.isDirectory()) {
    throw new Error(
      `${abs} is a directory. Pass the individual files as an array: filePath: ["a.jpg", "b.jpg"].`
    );
  }

  const contentType = MIME_BY_EXT[ext];
  if (!contentType) {
    throw new Error(
      `Unsupported file extension "${ext || "(none)"}" on ${name}. Supported: ${Object.keys(MIME_BY_EXT).join(", ")}.`
    );
  }
  if (restrictToImages && !contentType.startsWith("image/")) {
    throw new Error(
      `${name} is ${contentType}, not an image. Use upload_file for video / audio / pdf / zip. ` +
        `upload_image accepts: ${IMAGE_EXTS.join(", ")}.`
    );
  }

  const raw = await readFile(abs);
  const prepared = await prepareLocalImage(raw, contentType, name);
  const data = await uploadBytesToSite({
    siteId,
    bytes: prepared.bytes,
    contentType: prepared.contentType,
    filename: name,
    width: prepared.width,
    height: prepared.height,
  });
  return { data, name, note: prepared.note };
}

/**
 * Read one or more local files and push them straight to Cloudflare / R2 via
 * signed direct upload — the bytes never enter the model's context, and never
 * hit the 4.5 MB serverless request cap.
 */
async function uploadLocalFiles(args, { restrictToImages }) {
  const target = getActiveTarget(args);
  if (target.type === "template") {
    throw new Error(
      `${restrictToImages ? "upload_image" : "upload_file"} is not supported for templates. ` +
        'Use hardcoded URLs (type: "url") instead.'
    );
  }

  const paths = toPathList(args.filePath);
  if (!paths.length) throw new Error("filePath is empty.");

  const blocks = [];
  const failures = [];
  for (const p of paths) {
    try {
      const { data, name, note } = await uploadOneFile(target.id, p, restrictToImages);
      const label = paths.length > 1 || note ? `${name}${note ? ` (${note})` : ""}` : undefined;
      blocks.push(formatUploadResult(data, { label }));
    } catch (e) {
      // One bad file in a batch shouldn't discard the uploads that worked —
      // report per-file and let the caller retry just the failures.
      failures.push(`  ✗ ${basename(String(p))}: ${e.message}`);
    }
  }

  if (!blocks.length) throw new Error(`No files uploaded.\n${failures.join("\n")}`);

  const text =
    blocks.join("\n\n") +
    (failures.length ? `\n\nFailed (${failures.length}):\n${failures.join("\n")}` : "");
  return { content: [{ type: "text", text }] };
}

module.exports = {
  async upload_image(args) {
    if (args.filePath) {
      return withContext(() => uploadLocalFiles(args, { restrictToImages: true }));
    }
    return delegated.upload_image(args);
  },

  async upload_file(args) {
    if (args.filePath) {
      return withContext(() => uploadLocalFiles(args, { restrictToImages: false }));
    }
    return delegated.upload_file(args);
  },
};
