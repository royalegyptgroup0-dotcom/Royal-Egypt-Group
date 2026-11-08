import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("owner inbox includes a protected read-only orders tab", async () => {
  const html = await readFile(new URL("../admin-inbox.html", import.meta.url), "utf8");
  assert.match(html, /data-tab="orders"/);
  assert.match(html, /id="ordersCount"/);
  assert.match(html, /else if\(activeTab==="orders"\)/);
  assert.match(html, /data\.orders\|\|\[\]/);
  assert.match(html, /item\.order_type==="coffee"/);
  assert.doesNotMatch(html, /localStorage|innerHTML/);
});
