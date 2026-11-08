import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, worker, rawFeed] = await Promise.all([
  readFile(new URL("./index.html", import.meta.url), "utf8"),
  readFile(new URL("./_worker.js", import.meta.url), "utf8"),
  readFile(new URL("./posts.json", import.meta.url), "utf8")
]);

const feed = JSON.parse(rawFeed);
assert.equal(feed.version, 1, "feed version must be 1");
assert.ok(Array.isArray(feed.posts), "feed.posts must be an array");
const days = new Set();
for (const post of feed.posts) {
  assert.ok(Number.isInteger(Number(post.day)) && Number(post.day) > 0, "every post needs a positive day");
  assert.ok(!days.has(Number(post.day)), "post days must be unique");
  days.add(Number(post.day));
  assert.equal(post.status, "Published", "public fallback may contain only published posts");
  for (const field of ["title", "article", "ideaOfTheDay", "ceoChallenge", "discussionQuestion"]) {
    assert.ok(typeof post[field] === "string" && post[field].trim(), `post ${post.day} needs ${field}`);
  }
}

const htmlMarkers = [
  'rel="canonical" href="https://ceo-notes.pages.dev/"',
  'href="https://ceo-notes.pages.dev/rss.xml"',
  'id="world-clocks"',
  'id="market-board"',
  'fetch("/markets"',
  'async function loadPosts()',
  'for(const url of ["/feed",fallbackUrl])',
  'posts.json',
  'prefers-reduced-motion',
  'share-button',
  'navigator.share',
  'titleLink.href = "/post/"',
  'selectedPostDay',
  'card.id = "post-"'
];
for (const marker of htmlMarkers) assert.ok(html.includes(marker), `homepage is missing: ${marker}`);

for (const zone of ["Africa/Cairo", "Europe/London", "America/New_York", "Europe/Moscow", "Asia/Dubai"]) {
  assert.ok(html.includes(zone), `world clock is missing timezone: ${zone}`);
}

const workerMarkers = [
  'const HTML=',
  'const POSTS=',
  'url.pathname==="/feed"',
  'url.pathname==="/markets"',
  'frankfurter.dev',
  'async function marketData(origin)',
  'api.frankfurter.dev/v2/rates',
  'url.pathname==="/rss.xml"',
  'url.pathname==="/sitemap.xml"',
  'url.pathname==="/robots.txt"',
  'const articleMatch=url.pathname.match(',
  'function articleHtml(post)',
  'ceo-notes.pages.dev/post/',
  'caches.default.put',
  'caches.default.match',
  'Cache-Control',
  'no-store'
];
for (const marker of workerMarkers) assert.ok(worker.includes(marker), `Pages Worker is missing: ${marker}`);

console.log(`CEO Notes checks passed: ${feed.posts.length} published posts, 5 world clocks, article routes, RSS, sitemap, robots, and resilient feed.`);
