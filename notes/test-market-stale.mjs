import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./_worker.js", import.meta.url), "utf8");
const moduleUrl = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const { default: worker } = await import(moduleUrl);

const fx = [{ date: "2026-11-08", base: "USD", quote: "EGP", rate: 54.026 }];
const gold = [{ date: "2026-11-08", base: "XAU", quote: "USD", rate: 4089.31 }];
let cachedResponse = null;
let writtenResponse = null;

globalThis.caches = {
  default: {
    async match() {
      return cachedResponse ? cachedResponse.clone() : null;
    },
    async put(_key, response) {
      writtenResponse = response.clone();
      cachedResponse = response.clone();
    }
  }
};

async function requestMarkets() {
  return worker.fetch(new Request("https://test.ceo-notes.pages.dev/markets"));
}

// Fresh provider response is labelled fresh and carries retrieval time.
cachedResponse = null;
writtenResponse = null;
let providerCalls = 0;
globalThis.fetch = async (url) => {
  providerCalls += 1;
  const payload = String(url).includes("base=XAU") ? gold : fx;
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};
let response = await requestMarkets();
let data = await response.json();
assert.equal(response.status, 200);
assert.equal(data.stale, false);
assert.ok(data.fetchedAt);
assert.equal(providerCalls, 2);
assert.match(writtenResponse.headers.get("Cache-Control") || "", /max-age=259200/);

// A 12-hour-old cached value is returned as stale if both providers fail.
cachedResponse = new Response(JSON.stringify({
  date: "2026-11-07",
  fx,
  gold,
  source: "Frankfurter",
  frequency: "daily_reference",
  fetchedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  stale: false
}), { headers: { "Content-Type": "application/json" } });
globalThis.fetch = async () => { throw new Error("simulated provider outage"); };
response = await requestMarkets();
data = await response.json();
assert.equal(response.status, 200);
assert.equal(data.stale, true);
assert.equal(data.staleReason, "provider_unavailable");
assert.equal(response.headers.get("X-Data-Stale"), "true");
assert.ok(response.headers.get("Warning"));

// With no cached value, provider failure is explicit and never disguised as fresh data.
cachedResponse = null;
response = await requestMarkets();
data = await response.json();
assert.equal(response.status, 503);
assert.equal(data.error, "market_data_unavailable");
assert.equal(response.headers.get("Cache-Control"), "no-store");

console.log("Market freshness checks passed: fresh, stale fallback, and no-data failure.");
