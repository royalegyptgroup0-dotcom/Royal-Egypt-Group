import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./worker-v2.js", import.meta.url), "utf8");
const workerModule = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const worker = workerModule.default;
const CEOOutboxCoordinator = workerModule.CEOOutboxCoordinator;
const token = "test-only-admin-token-with-at-least-32-characters";
const auth = { Authorization: "Bearer " + token };

function makeKV(seed = {}) {
  const values = new Map(Object.entries(seed).map(([key, value]) => [key, String(value)]));
  return {
    values,
    async get(key) { return values.has(key) ? values.get(key) : null; },
    async put(key, value) { values.set(key, String(value)); },
    async delete(key) { values.delete(key); },
    async list({ prefix = "", limit = 1000 } = {}) {
      return { keys: [...values.keys()].filter(key => key.startsWith(prefix)).slice(0, limit).map(name => ({ name })) };
    }
  };
}

function makeEnv({ posts = [], adminToken = token } = {}) {
  const kv = makeKV({ feed: JSON.stringify({ version: 1, posts }) });
  const calls = { text: 0, image: 0 };
  const article = "في بيئة العمل، القرار الجيد لا يبدأ دائمًا بإجابة سريعة. أحيانًا يحتاج الفريق إلى فهم المشكلة، وتحديد المسؤوليات، ومراجعة أثر الاختيارات قبل التنفيذ. ".repeat(5);
  const ai = {
    async run(model) {
      if (model.includes("flux")) {
        calls.image += 1;
        return { image: "aGVsbG8=", usage: { neurons: 1 } };
      }
      calls.text += 1;
      return {
        response: JSON.stringify({
          day: 1,
          title: "الوضوح قبل سرعة التنفيذ",
          article,
          ideaOfTheDay: "الوضوح يقلل تكلفة إعادة العمل.",
          ceoChallenge: "خلال 48 ساعة، اكتب مسؤولية واحدة غير واضحة وحدد صاحب القرار.",
          discussionQuestion: "ما أكثر نقطة تسبب التباسًا في تسليم المهام داخل فريقك؟",
          hashtags: "#CEO_Notes #CEO_Challenge #فكرة_اليوم #إدارة #قيادة #وضوح",
          imagePrompt: "A realistic executive team reviewing a clear project plan, cinematic black and antique gold palette, no text."
        }),
        usage: { neurons: 1 }
      };
    }
  };
  const coordinatorValues = new Map();
  let queue = Promise.resolve();
  const state = {
    storage: {
      async get(key) { return coordinatorValues.get(key); },
      async put(key, value) { coordinatorValues.set(key, structuredClone(value)); },
      async delete(key) { coordinatorValues.delete(key); },
      async list({ prefix = "" } = {}) { return new Map([...coordinatorValues.entries()].filter(([key]) => key.startsWith(prefix))); }
    },
    blockConcurrencyWhile(callback) {
      const run = queue.then(callback);
      queue = run.catch(() => {});
      return run;
    }
  };
  const coordinatorObject = new CEOOutboxCoordinator(state, {});
  const coordinatorNamespace = {
    idFromName(name) { return name; },
    get() { return { fetch(request) { return coordinatorObject.fetch(request); } }; }
  };
  return { ADMIN_TOKEN: adminToken, CEO_NOTES_KV: kv, AI: ai, OUTBOX_COORDINATOR: coordinatorNamespace, coordinatorValues, calls };
}

async function call(path, { method = "GET", headers = {}, body } = {}, env = makeEnv()) {
  const request = new Request("https://worker.test" + path, {
    method,
    headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return worker.fetch(request, env, { waitUntil() {} });
}

async function createPublishedPost(env) {
  const generatedResponse = await call("/api/generate", { method: "POST", headers: auth, body: {} }, env);
  assert.equal(generatedResponse.status, 200);
  const generated = await generatedResponse.json();
  const imageResponse = await call("/api/image", {
    method: "POST",
    headers: auth,
    body: { date: generated.date, post: generated.post, imagePrompt: generated.imagePrompt }
  }, env);
  assert.equal(imageResponse.status, 200);
  const image = await imageResponse.json();
  const publishResponse = await call("/api/publish", {
    method: "POST",
    headers: auth,
    body: { date: generated.date, post: image.post }
  }, env);
  assert.equal(publishResponse.status, 200);
  return { generated, image, publish: await publishResponse.json() };
}

test("health and canonical feed remain public", async () => {
  const env = makeEnv();
  const health = await call("/health", {}, env);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ok, true);
  const feed = await call("/feed", {}, env);
  assert.equal(feed.status, 200);
  assert.deepEqual((await feed.json()).posts, []);
});

test("all API routes fail closed without the configured bearer secret", async () => {
  const env = makeEnv({ adminToken: null });
  for (const path of ["/api/generate", "/api/image", "/api/publish", "/api/outbox/reserve"]) {
    const response = await call(path, { method: "POST", headers: auth, body: {} }, env);
    assert.equal(response.status, 401, path);
  }
});

test("protected API uses POST and no longer exposes path-token routes", async () => {
  const env = makeEnv();
  assert.equal((await call("/api/generate", {}, env)).status, 405);
  assert.equal((await call("/api/image?day=28", {}, env)).status, 405);
  assert.equal((await call("/api/publish", {}, env)).status, 405);
  assert.ok(source.includes('const API_GEN_PATH="/api/generate";'));
});

test("editorial generation is reused for the same Cairo date", async () => {
  const env = makeEnv();
  const firstResponse = await call("/api/generate", { method: "POST", headers: auth, body: {} }, env);
  const first = await firstResponse.json();
  const secondResponse = await call("/api/generate", { method: "POST", headers: auth, body: {} }, env);
  const second = await secondResponse.json();
  assert.equal(firstResponse.status, 200);
  assert.equal(secondResponse.status, 200);
  assert.equal(first.post.day, 1);
  assert.equal(second.reused, true);
  assert.equal(second.contentHash, first.contentHash);
  assert.equal(env.calls.text, 1);
});

test("image generation is POST-only and idempotent for the same draft hash", async () => {
  const env = makeEnv();
  const generatedResponse = await call("/api/generate", { method: "POST", headers: auth, body: {} }, env);
  const generated = await generatedResponse.json();
  const payload = { date: generated.date, post: generated.post, imagePrompt: generated.imagePrompt };
  const firstResponse = await call("/api/image", { method: "POST", headers: auth, body: payload }, env);
  const first = await firstResponse.json();
  const secondResponse = await call("/api/image", { method: "POST", headers: auth, body: payload }, env);
  const second = await secondResponse.json();
  assert.equal(firstResponse.status, 200);
  assert.equal(secondResponse.status, 200);
  assert.equal(second.reused, true);
  assert.equal(env.calls.image, 1);
  const metadata = JSON.parse(await env.CEO_NOTES_KV.get("image-meta:1"));
  assert.equal(metadata.contentHash, generated.contentHash);
});

test("feed publication is idempotent and refuses conflicting content for an existing day", async () => {
  const env = makeEnv();
  const { generated, image, publish } = await createPublishedPost(env);
  assert.equal(publish.alreadyPublished, false);
  const repeat = await call("/api/publish", {
    method: "POST",
    headers: auth,
    body: { date: generated.date, post: image.post }
  }, env);
  assert.equal(repeat.status, 200);
  assert.equal((await repeat.json()).alreadyPublished, true);
  const conflict = await call("/api/publish", {
    method: "POST",
    headers: auth,
    body: { date: generated.date, post: { ...image.post, title: "عنوان مختلف" } }
  }, env);
  assert.equal(conflict.status, 409);
});

test("outbox reserves, starts and stores an independently verifiable receipt", async () => {
  const env = makeEnv();
  const { generated } = await createPublishedPost(env);
  const base = { day: generated.post.day, platform: "facebook", identity: "ceo-page", contentHash: generated.contentHash };
  const reserve = await call("/api/outbox/reserve", { method: "POST", headers: auth, body: base }, env);
  assert.equal(reserve.status, 200);
  assert.equal((await reserve.json()).decision, "publish");
  const start = await call("/api/outbox/start", { method: "POST", headers: auth, body: base }, env);
  assert.equal(start.status, 200);
  assert.equal((await start.json()).status, "attempting");
  const receipt = await call("/api/outbox/receipt", {
    method: "POST",
    headers: auth,
    body: { ...base, postId: "123_456", permalink: "https://www.facebook.com/123_456", publishedAt: "2026-11-12T18:00:00.000Z" }
  }, env);
  assert.equal(receipt.status, 200);
  assert.equal((await receipt.json()).receipt.status, "receipt_recorded");
  const blockedBeforeVerification = await call("/api/outbox/reserve", { method: "POST", headers: auth, body: base }, env);
  assert.equal(blockedBeforeVerification.status, 409);
  const rejectedVerification = await call("/api/outbox/verify", {
    method: "POST", headers: auth, body: { ...base, verified: true, verifiedPostId: "123_456", verificationSource: "manual_assertion", verificationStatus: "published" }
  }, env);
  assert.equal(rejectedVerification.status, 403);
  const verify = await call("/api/outbox/verify", {
    method: "POST", headers: auth, body: { ...base, verified: true, verifiedPostId: "123_456", verifiedPermalink: "https://www.facebook.com/123_456", verificationSource: "facebook_graph_api", verificationStatus: "published" }
  }, env);
  assert.equal(verify.status, 200);
  assert.equal((await verify.json()).status, "succeeded");
  const retry = await call("/api/outbox/reserve", { method: "POST", headers: auth, body: base }, env);
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).decision, "skip");
  const stored = env.coordinatorValues.get("outbox:facebook:ceo-page:1");
  assert.equal(stored.postId, "123_456");
  assert.equal(stored.permalink, "https://www.facebook.com/123_456");
});

test("CEO Notes identities remain isolated from corporate Facebook", async () => {
  const env = makeEnv();
  const { generated } = await createPublishedPost(env);
  const shared = { day: generated.post.day, contentHash: generated.contentHash };
  const facebook = await call("/api/outbox/reserve", {
    method: "POST", headers: auth, body: { ...shared, platform: "facebook", identity: "royal-egypt-properties" }
  }, env);
  const instagram = await call("/api/outbox/reserve", {
    method: "POST", headers: auth, body: { ...shared, platform: "instagram", identity: "ceo-notes" }
  }, env);
  const excludedInstagram = await call("/api/outbox/reserve", {
    method: "POST", headers: auth, body: { ...shared, platform: "instagram", identity: "royal-egypt-properties" }
  }, env);
  assert.equal(facebook.status, 400);
  assert.equal(instagram.status, 200);
  assert.equal(excludedInstagram.status, 400);
});

test("ambiguous publication is blocked until explicit reconciliation", async () => {
  const env = makeEnv();
  const { generated } = await createPublishedPost(env);
  const base = { day: generated.post.day, platform: "instagram", identity: "ceo-notes", contentHash: generated.contentHash };
  await call("/api/outbox/reserve", { method: "POST", headers: auth, body: base }, env);
  await call("/api/outbox/start", { method: "POST", headers: auth, body: base }, env);
  const unknown = await call("/api/outbox/unknown", {
    method: "POST", headers: auth, body: { ...base, reason: "network_timeout_after_publish_request" }
  }, env);
  assert.equal(unknown.status, 200);
  const blocked = await call("/api/outbox/reserve", { method: "POST", headers: auth, body: base }, env);
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).status, "unknown");
  const reconcile = await call("/api/outbox/reconcile", {
    method: "POST", headers: auth, body: { ...base, action: "not_published" }
  }, env);
  assert.equal(reconcile.status, 200);
  assert.equal((await reconcile.json()).retryAllowed, true);
  const retry = await call("/api/outbox/reserve", { method: "POST", headers: auth, body: base }, env);
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).decision, "publish");
});

test("concurrent reserve requests grant exactly one publication claim", async () => {
  const env = makeEnv();
  const { generated } = await createPublishedPost(env);
  const base = { day: generated.post.day, platform: "facebook", identity: "ceo-page", contentHash: generated.contentHash };
  const responses = await Promise.all(Array.from({ length: 24 }, () =>
    call("/api/outbox/reserve", { method: "POST", headers: auth, body: base }, env)
  ));
  assert.equal(responses.filter(response => response.status === 200).length, 1);
  assert.equal(responses.filter(response => response.status === 409).length, 23);
  const body = await Promise.all(responses.map(response => response.json()));
  assert.equal(body.filter(item => item.decision === "publish").length, 1);
});

test("backup includes feed, images, image metadata, drafts and per-platform outbox records", async () => {
  const env = makeEnv();
  const { generated } = await createPublishedPost(env);
  const base = { day: generated.post.day, platform: "facebook", identity: "ceo-page", contentHash: generated.contentHash };
  await call("/api/outbox/reserve", { method: "POST", headers: auth, body: base }, env);
  const pending = [];
  worker.scheduled({ scheduledTime: Date.parse("2026-11-12T02:00:00.000Z") }, env, {
    waitUntil(promise) { pending.push(promise); }
  });
  await Promise.all(pending);
  const manifest = JSON.parse(await env.CEO_NOTES_KV.get("backup:2026-11-12:manifest"));
  assert.equal(manifest.version, 3);
  assert.equal(manifest.coordinatorOutboxCount, 1);
  assert.ok(manifest.coordinatorOutboxSha256);
  assert.equal(manifest.postDays.includes(generated.post.day), true);
  assert.equal(manifest.imageMetaKeys.some(item => item.name === "image-meta:1"), true);
  assert.equal(manifest.outboxKeys.some(item => item.name === "outbox:facebook:ceo-page:1"), false);
  assert.equal(await env.CEO_NOTES_KV.get("backup:2026-11-12:outbox-coordinator") !== null, true);
  assert.equal(manifest.draftKeys.some(item => item.name.startsWith("draft:")), true);
});
