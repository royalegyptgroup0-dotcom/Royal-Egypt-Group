#!/usr/bin/env node
/**
 * Offline, dependency-free importer for Meta/Facebook "Download your information"
 * JSON archives. It creates a reviewable candidate feed; it never publishes to
 * Facebook and never overwrites the canonical feed unless --apply is explicit.
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

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

function stableKeys(post) {
  const keys = [];
  const id = norm(post.facebookPostId || post.id);
  const permalink = norm(post.permalinkUrl || post.permalink_url);
  const content = norm(post.article || post.message || post.title).toLocaleLowerCase();
  const date = String(post.publishedAt || "").slice(0, 10);
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
    tags: [],
    source: "facebook-archive",
    facebookPostId: rawId ? String(rawId) : undefined,
    sourcePostId: rawId ? identity : undefined,
    permalinkUrl: typeof permalinkUrl === "string" ? permalinkUrl : undefined,
    archiveSourceFile: sourceFile
  };
}

async function walkJsonFiles(root) {
  const found = [];
  async function visit(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!["photos", "videos", "audio", "html"].includes(entry.name.toLowerCase())) await visit(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json") &&
                 /post|publication|timeline/i.test(full)) {
        found.push(full);
      }
    }
  }
  const stat = await fs.stat(root);
  if (stat.isFile()) {
    if (!root.toLowerCase().endsWith(".json")) throw new Error("Input file must be JSON; extract the Meta ZIP first.");
    found.push(root);
  } else await visit(root);
  return found.sort();
}

export async function buildImport({ input, current }) {
  const files = await walkJsonFiles(input);
  if (!files.length) throw new Error("No Facebook post JSON files found. Check that the Meta export ZIP was extracted and the posts folder is included.");
  const imported = [];
  for (const file of files) {
    let parsed;
    try { parsed = JSON.parse((await fs.readFile(file, "utf8")).replace(/^\uFEFF/, "")); }
    catch (error) { throw new Error("Invalid JSON in " + file + ": " + error.message); }
    for (const record of findRecords(parsed)) {
      const post = toCandidate(record, path.relative(input, file));
      if (post) imported.push(post);
    }
  }

  const existing = current?.posts ?? [];
  if (!Array.isArray(existing)) throw new Error("Current feed must contain a posts array.");
  const known = new Set(existing.flatMap(stableKeys));
  const unique = new Map();
  for (const post of imported) {
    const keys = stableKeys(post);
    if (!keys.some((key) => known.has(key))) {
      unique.set(keys[0] || "content:" + createHash("sha256").update(post.publishedAt + "\n" + post.article).digest("hex"), post);
      for (const key of keys) known.add(key);
    }
  }
  const additions = [...unique.values()].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
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
      skippedDuplicates: imported.length - additions.length,
      importedDateRange: additions.length ? {
        first: additions[0].publishedAt,
        last: additions.at(-1).publishedAt
      } : null,
      note: "Review the candidate before replacing notes/posts.json. Facebook archive posts are imported to the website only; no social publishing is performed."
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
    console.error("Usage: node scripts/import-ceo-facebook-archive.mjs --input <extracted-archive-or-posts.json> --current notes/posts.json [--output notes/posts.import-preview.json] [--apply]");
    process.exitCode = 2;
    return;
  }
  const current = JSON.parse(await fs.readFile(args.current, "utf8"));
  const candidate = await buildImport({ input: args.input, current });
  const output = args.output || "notes/posts.import-preview.json";
  const destination = args.apply ? (args.output || args.current) : output;
  if (!args.apply && path.resolve(destination) === path.resolve(args.current)) {
    throw new Error("Refusing to overwrite the canonical feed without --apply.");
  }
  await fs.writeFile(destination, JSON.stringify({ version: candidate.version, posts: candidate.posts }, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ output: destination, ...candidate.importReport }, null, 2));
  if (args.apply) console.warn("Applied locally only. Review and commit the file deliberately; this command does not publish or deploy.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
