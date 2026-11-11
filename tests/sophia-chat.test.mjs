import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../assets/sophia-chat.js", import.meta.url), "utf8");

function client(fetchImpl) {
  const context = { window: {}, fetch: fetchImpl, JSON, Error };
  vm.runInNewContext(source, context);
  return context.window.RoyalSophia;
}

test("sends the conversation to the same-origin assistant API and returns its answer", async () => {
  let request;
  const api = client(async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ answer: "  أهلاً بك  " }) };
  });

  const answer = await api.ask([
    { role: "assistant", text: "Welcome" },
    { role: "user", text: "أبحث عن فيلا" }
  ]);

  assert.equal(answer, "أهلاً بك");
  assert.equal(request.url, "/api/assistant");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(request.options.body), {
    messages: [
      { role: "assistant", content: "Welcome" },
      { role: "user", content: "أبحث عن فيلا" }
    ]
  });
});

test("surfaces a server error without pretending the assistant replied", async () => {
  const api = client(async () => ({
    ok: false,
    json: async () => ({ error: "rate_limited" })
  }));
  await assert.rejects(() => api.ask([{ role: "user", text: "Hello" }]), /rate_limited/);
});

test("rejects an empty successful response", async () => {
  const api = client(async () => ({
    ok: true,
    json: async () => ({ answer: "   " })
  }));
  await assert.rejects(() => api.ask([{ role: "user", text: "Hello" }]), /assistant_unavailable/);
});
