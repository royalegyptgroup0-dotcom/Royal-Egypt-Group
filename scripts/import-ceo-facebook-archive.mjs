#!/usr/bin/env node
/**
 * Offline, dependency-free importer for Meta/Facebook "Download your information"
 * JSON archives. Copies referenced image attachments into the site's local
 * images folder and creates a reviewable feed; it never publishes to Facebook.
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".heic", ".heif"]);
const norm = (value) => String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();

const isoDate = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value > 1e12 ? value : value * 1000);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
};

function textFromRecord(record) {
  const parts = [];
  for (const key of ["message", "post", "text", "caption", "content", "description"]) {
    if (typeof record?.[key] === "string" && norm(record[key])) parts.push(record[key].trim());
  }
  if (Array.isArray(record?.data)) {
    for (const item of record.data) {
      if (!item || typeof item !== "object") continue;
      for (const key of ["post", "text", "message", "description"]) {
        if (typeof item[key] === "string" && norm(item[key])) parts.push(item[key].trim());
      }
    }
  }
  return [...new Set(parts)].join("\n\n").trim();
}

function findRecords(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) findRecords(item, output);
    return output;
  }
  if (!value || typeof value !== "object") return output;
  const timestamp = value.timestamp ?? value.creation_timestamp ?? value.created_time ?? value.creation_time;
  const body = textFromRecord(value) || norm(value.title);
  if (timestamp != null && body) output.push(value);
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === "object" && key !== "attachments" && key !== "media") findRecords(child, output);
  }
  return output;
}

function mediaReferences(record) {
  const found = new Set();
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    for (const key of ["uri", "downloaded_content_uri", "file_uri"]) {
      const uri = value[key];
      if (typeof uri !== "string" || !uri.trim()) continue;
      const ext = path.extname(uri.split(/[?#]/, 1)[0]).toLowerCase();
      const mime = String(value.mime_type ?? value.mimeType ?? value.type ?? "").toLowerCase();
      if (IMAGE_EXTENSIONS.has(ext) || mime.startsWith("image/")) found.add(uri.trim());
    }
    for (const key of ["attachments", "media", "data"]) {
      if (value[key] && typeof value[key] === "object") visit(value[key]);
    }
  };
  visit(record?.attachments);
  visit(record?.media);
  visit(record?.data);
  return [...found];
}

function stableKeys(post) {
  const keys = [];
  const id = norm(post.facebookPostId || post.id || post.sourcePostId);
  const permalink = norm(post.permalinkUrl || post.permalink_url || post.sourceUrl);
  const content = norm(post.article || post.message || post.title).toLocaleLowerCase();
  const date = String(post.publishedAt || post.sourcePublishedAt || "").slice(0, 10);
  if (id) keys.push("id:" + id);
  if (permalink) keys.push("url:" + permalink);
  if (content) keys.push("content:" + createHash("sha256").update(date + "\n" + content).digest("hex"));
  return keys;
}

function toCandidate(record, sourceFile) {
  const article = textFromRecord(record) || norm(record.title);
  const publishedAt = isoDate(record.timestamp ?? record.creation_timestamp ?? record.created_time ?? record.creation_time);
  if (!article || !publishedAt) return null;
  const rawId = record.post_id ?? record.id ?? record.fbid ?? record.facebook_post_id ?? null;
  const permalinkUrl = record.permalink_url ?? record.permalink ?? record.url ?? null;
  const titleCandidate = norm(record.title || article.split(/\r?\n/)[0]);
  const title = titleCandidate.length > 110 ? titleCandidate.slice(0, 107) + "…" : titleCandidate;
  const identity = rawId ? String(rawId) : createHash("sha256").update(publishedAt + "\n" + article).digest("hex");
  const sourcePageId = rawId && /^\d+_/.test(String(rawId))
    ? String(rawId).split("_", 1)[0]
    : "115226621594988";
  return {
    title: title || "من أرشيف CEO Notes",
    article,
    ideaOfTheDay: "",
    ceoChallenge: "",
    discussionQuestion: "",
    hashtags: "",
    status: "Published",
    publishedAt,
    category: "أرشيف فيسبوك",
    tags: ["أرشيف فيسبوك"],
    source: "facebook-archive",
    archiveImported: true,
    sourcePageId,
    sourcePostId: rawId ? identity : undefined,
    facebookPostId: rawId ? String(rawId) : undefined,
    sourceUrl: typeof permalinkUrl === "string" ? permalinkUrl : undefined,
    sourcePublishedAt: publishedAt,
    sourceEvidence: "facebook_page_post",
    archiveSourceFile: sourceFile,
    _mediaReferences: mediaReferences(record)
  };
}

async function walkJsonFiles(input) {
  const found = [];
  async function visit(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!["videos", "audio", "html"].includes(entry.name.toLowerCase())) await visit(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json") &&
                 /post|publication|timeline/i.test(full)) {
        found.push(full);
      }
    }
  }
  const stat = await fs.stat(input);
  if (stat.isFile()) {
    if (!input.toLowerCase().endsWith(".json")) throw new Error("Input file must be JSON; extract the Meta ZIP first.");
    found.push(input);
  } else await visit(input);
  return found.sort();
}

function safeArchivePath(root, uri) {
  let decoded = uri;
  try { decoded = decodeURIComponent(uri); } catch {}
  decoded = decoded.replace(/\\/g, "/").replace(/^\.\/+/, "");
  if (/^(?:[a-z]+:|\/|\\\\)/i.test(decoded)) return null;
  const resolved = path.resolve(root, decoded);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return resolved;
}

async function copyPostImages(post, { archiveRoot, mediaOutput, mediaUrlPrefix, mediaCache }) {
  const urls = [];
  let missing = 0;
  const references = post._mediaReferences || [];
  for (const uri of references) {
    const source = safeArchivePath(archiveRoot, uri);
    if (!source) {
      missing++;
      continue;
    }
    try {
      const bytes = await fs.readFile(source);
      const ext = path.extname(source).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(ext)) {
        missing++;
        continue;
      }
      const digest = createHash("sha256").update(bytes).digest("hex");
      let filename = mediaCache.get(digest);
      if (!filename) {
        filename = "fb-" + digest.slice(0, 24) + ext;
        await fs.mkdir(mediaOutput, { recursive: true });
        const destination = path.join(mediaOutput, filename);
        try { await fs.access(destination); }
        catch { await fs.writeFile(destination, bytes, { flag: "wx" }).catch(async (error) => {
          if (error.code !== "EEXIST") throw error;
        }); }
        mediaCache.set(digest, filename);
      }
      urls.push(mediaUrlPrefix.replace(/\/$/, "") + "/" + filename);
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "EISDIR") missing++;
      else throw error;
    }
  }
  delete post._mediaReferences;
  post.images = [...new Set(urls)];
  if (post.images.length) post.imageUrl = post.images[0];
  return { copied: post.images.length, missing, references: references.length };
}
function mergeImages(target, incoming) {
  const current = Array.isArray(target.images) ? target.images : [];
  const combined = [...current, ...(incoming.images || [])]
    .filter((value) => typeof value === "string" && value.trim());
  target.images = [...new Set(combined)];
  if (!target.imageUrl && target.images.length) target.imageUrl = target.images[0];
  return target.images.length;
}

export async function buildImport({
  input,
  current,
  mediaOutput,
  mediaUrlPrefix = "/images/facebook-archive",
}) {
  const files = await walkJsonFiles(input);
  if (!files.length) throw new Error("No Facebook post JSON files found. Check that the Meta export ZIP was extracted and the posts folder is included.");
  const archiveRoot = (await fs.stat(input)).isDirectory() ? path.resolve(input) : path.dirname(path.resolve(input));
  const imported = [];
  for (const file of files) {
    let parsed;
    try { parsed = JSON.parse((await fs.readFile(file, "utf8")).replace(/^\uFEFF/, "")); }
    catch (error) { throw new Error("Invalid JSON in " + file + ": " + error.message); }
    for (const record of findRecords(parsed)) {
      const post = toCandidate(record, path.relative(archiveRoot, file));
      if (post) imported.push(post);
    }
  }

  const existing = current?.posts ?? [];
  if (!Array.isArray(existing)) throw new Error("Current feed must contain a posts array.");
  const mediaCache = new Map();
  let mediaCopied = 0;
  let recordsWithMedia = 0;
  let mediaReferencesFound = 0;
  let mediaMissingOrUnsafe = 0;
  if (mediaOutput) {
    for (const post of imported) {
      const result = await copyPostImages(post, {
        archiveRoot,
        mediaOutput: path.resolve(mediaOutput),
        mediaUrlPrefix,
        mediaCache,
      });
      if (result.references) recordsWithMedia++;
      mediaReferencesFound += result.references;
      mediaMissingOrUnsafe += result.missing;
      mediaCopied += result.copied;
    }
  } else {
    for (const post of imported) {
      const references = post._mediaReferences?.length || 0;
      if (references) recordsWithMedia++;
      mediaReferencesFound += references;
      delete post._mediaReferences;
      post.images = [];
    }
  }

  const known = new Set();
  const existingByKey = new Map();
  for (const post of existing) {
    for (const key of stableKeys(post)) {
      known.add(key);
      if (!existingByKey.has(key)) existingByKey.set(key, post);
    }
  }

  const additionsByKey = new Map();
  let skippedDuplicates = 0;
  let existingPostsEnriched = 0;
  for (const post of imported) {
    const keys = stableKeys(post);
    const matchKey = keys.find((key) => known.has(key));
    if (matchKey) {
      const target = existingByKey.get(matchKey) || additionsByKey.get(matchKey);
      if (target && post.images?.length) {
        const before = Array.isArray(target.images) ? target.images.length : 0;
        mergeImages(target, post);
        if (existing.includes(target) && target.images.length > before) existingPostsEnriched++;
      }
      skippedDuplicates++;
      continue;
    }
    const uniqueKey = keys[0] || "content:" + createHash("sha256").update(post.publishedAt + "\n" + post.article).digest("hex");
    const prior = additionsByKey.get(uniqueKey);
    if (prior) {
      mergeImages(prior, post);
      skippedDuplicates++;
      continue;
    }
    additionsByKey.set(uniqueKey, post);
    for (const key of keys) {
      known.add(key);
      existingByKey.set(key, post);
    }
  }

  const additions = [...additionsByKey.values()].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const usedDays = new Set(existing.map((p) => Number(p.day)).filter(Number.isInteger));
  let nextDay = 1;
  for (const post of additions) {
    while (usedDays.has(nextDay)) nextDay++;
    post.day = nextDay;
    usedDays.add(nextDay++);
  }
  const posts = [...existing, ...additions].sort((a, b) => Number(a.day) - Number(b.day));
  return {
    version: current?.version ?? 1,
    posts,
    importReport: {
      sourceFiles: files.length,
      scannedRecords: imported.length,
      imported: additions.length,
      existingCount: existing.length,
      skippedDuplicates,
      existingPostsEnriched,
      recordsWithMedia,
      mediaReferencesFound,
      mediaCopied,
      uniqueMediaFiles: mediaCache.size,
      mediaMissingOrUnsafe,
      importedDateRange: additions.length ? {
        first: additions[0].publishedAt,
        last: additions.at(-1).publishedAt
      } : null,
      note: "Review the candidate feed and copied images before replacing notes/posts.json. Website import only; no social publishing is performed."
    }
  };
}

function argsFrom(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    if (name === "apply") args.apply = true;
    else args[name] = argv[++i];
  }
  return args;
}

async function main() {
  const args = argsFrom(process.argv);
  if (!args.input || !args.current) {
    console.error("Usage: node scripts/import-ceo-facebook-archive.mjs --input <extracted-archive-or-posts.json> --current notes/posts.json [--output notes/posts.import-preview.json] [--media-output notes/images/facebook-archive] [--media-url-prefix /images/facebook-archive] [--apply]");
    process.exitCode = 2;
    return;
  }
  const current = JSON.parse(await fs.readFile(args.current, "utf8"));
  const candidate = await buildImport({
    input: args.input,
    current,
    mediaOutput: args["media-output"] || "notes/images/facebook-archive",
    mediaUrlPrefix: args["media-url-prefix"] || "/images/facebook-archive",
  });
  const output = args.output || "notes/posts.import-preview.json";
  const destination = args.apply ? (args.output || args.current) : output;
  if (!args.apply && path.resolve(destination) === path.resolve(args.current)) {
    throw new Error("Refusing to overwrite the canonical feed without --apply.");
  }
  await fs.writeFile(destination, JSON.stringify({ version: candidate.version, posts: candidate.posts }, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ output: destination, ...candidate.importReport }, null, 2));
  if (args.apply) console.warn("Applied locally only. Review and commit the feed and image files deliberately; this command does not publish or deploy.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
