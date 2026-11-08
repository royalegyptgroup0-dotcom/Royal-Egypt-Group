import assert from "node:assert/strict";
import { Script } from "node:vm";
import { readFile } from "node:fs/promises";

const [html, worker, rawFeed, radio] = await Promise.all([
  readFile(new URL("./index.html", import.meta.url), "utf8"),
  readFile(new URL("./_worker.js", import.meta.url), "utf8"),
  readFile(new URL("./posts.json", import.meta.url), "utf8"),
  readFile(new URL("./radio.js", import.meta.url), "utf8")
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
  assert.ok(typeof post.category === "string" && post.category.trim(), `post ${post.day} needs a category`);
  assert.ok(Array.isArray(post.tags) && post.tags.length > 0, `post ${post.day} needs topic tags`);
  assert.ok(post.tags.every(tag => typeof tag === "string" && tag.trim()), `post ${post.day} has invalid topic tags`);
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
  'card.id = "post-"',
  'id="ceo-radio"',
  'src="/radio.js"',
  'The United States Of America',
  'id="archive-controls"',
  'id="category-filter"',
  'id="tag-filters"',
  'function renderFilters()',
  'activeTag',
  'post.tags',
  'property="og:image"',
  'name="twitter:card"',
  'article:published_time'
];
for (const marker of htmlMarkers) assert.ok(html.includes(marker), `homepage is missing: ${marker}`);

const inlineScripts = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
assert.ok(inlineScripts.length > 0, "homepage must include its application script");
inlineScripts.forEach((match, index) => new Script(match[1], { filename: `ceo-notes-inline-${index + 1}.js` }));

for (const zone of ["Africa/Cairo", "Europe/London", "America/New_York", "Europe/Moscow", "Asia/Dubai"]) {
  assert.ok(html.includes(zone), `world clock is missing timezone: ${zone}`);
}
assert.ok(!/\bautoplay\b/i.test(html), "radio must never autoplay");

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
  'url.pathname==="/radio.css"',
  'url.pathname==="/radio.js"',
  'const RADIO_CSS=',
  'const RADIO_JS=',
  'const articleMatch=url.pathname.match(',
  'function articleHtml(post)',
  'ceo-notes.pages.dev/post/',
  'article:published_time',
  'article:section',
  'twitter:image',
  'taxonomy',
  'caches.default.put',
  'caches.default.match',
  'Cache-Control',
  'no-store'
];
for (const marker of workerMarkers) assert.ok(worker.includes(marker), `Pages Worker is missing: ${marker}`);

const radioMarkers = [
  'https://de1.api.radio-browser.info',
  'hidebroken: "true"',
  'limit: "24"',
  'is_https: "true"',
  'hls: "0"',
  'Number(station.hls) !== 1',
  'startsWith("https://")',
  'play.addEventListener("click"',
  'audio.play()',
  'AbortController',
  'replaceChildren',
  'textContent'
];
for (const marker of radioMarkers) assert.ok(radio.includes(marker), `radio module is missing: ${marker}`);
assert.ok(!/\.innerHTML\s*=/.test(radio), "radio rendering must not use unsafe innerHTML");

console.log(`CEO Notes checks passed: ${feed.posts.length} published posts, article routes, RSS, sitemap, robots, world clocks, and HTTPS radio safeguards.`);
