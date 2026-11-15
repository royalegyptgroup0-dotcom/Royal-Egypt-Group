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

function makeEnv({ posts = [], adminToken = token, previewMode = false, seedKV = {} } = {}) {
  const kv = makeKV({ feed: JSON.stringify({ version: 1, posts }), ...seedKV });
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
  const coordinatorValuesById = new Map([["ceo-notes-day:1", coordinatorValues]]);
  const coordinatorObjects = new Map();
  const coordinatorNamespace = {
    idFromName(name) { return name; },
    get(id) {
      if (!coordinatorObjects.has(id)) {
        let values = coordinatorValuesById.get(id);
        if (!values) {
          values = new Map();
          coordinatorValuesById.set(id, values);
        }
        const kv = {
          get(key) { return values.get(key); },
          put(key, value) { values.set(key, structuredClone(value)); },
          delete(key) { values.delete(key); },
          list({ prefix = "" } = {}) { return new Map([...values.entries()].filter(([key]) => key.startsWith(prefix))).entries(); }
        };
        const coordinatorObject = new CEOOutboxCoordinator({ storage: { kv } }, {});
        coordinatorObjects.set(id, coordinatorObject);
      }
      const coordinatorObject = coordinatorObjects.get(id);
      return { fetch(input, init) { return coordinatorObject.fetch(input instanceof Request ? input : new Request(input, init)); } };
    }
  };
  return { ADMIN_TOKEN: adminToken, META_APP_ID: "test-meta-app-id", META_APP_SECRET: "test-only-meta-app-secret-123456789", META_FACEBOOK_PAGE_ACCESS_TOKEN: "test-only-facebook-token-123456789", META_INSTAGRAM_ACCESS_TOKEN: "test-only-instagram-token-123456789", PREVIEW_MODE: previewMode ? "true" : undefined, CEO_NOTES_KV: kv, AI: ai, OUTBOX_COORDINATOR: coordinatorNamespace, coordinatorValues, calls };
}

async function call(path, { method = "GET", headers = {}, body } = {}, env = makeEnv()) {
  const request = new Request("https://worker.test" + path, {
    method,
    headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return worker.fetch(request, env, { waitUntil() {} });
}

async function withMetaReadBack(data, work, platform = "facebook") {
  const originalFetch = globalThis.fetch;
  const expectedToken = platform === "facebook" ? "test-only-facebook-token-123456789" : "test-only-instagram-token-123456789";
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    assert.equal(url.hostname, "graph.facebook.com");
    assert.equal(url.searchParams.get("access_token"), expectedToken);
    assert.match(url.searchParams.get("appsecret_proof")||"", /^[a-f0-9]{64}$/);
    assert.equal(init.headers?.Authorization, undefined);
    assert.ok(url.pathname.startsWith("/v27.0/"));
    return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
  };
  try { return await work(); }
  finally { globalThis.fetch = originalFetch; }
}

async function withMetaPublish(platform, work, mode = "success") {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    const method = init.method || "GET";
    requests.push({ method, path: url.pathname, body: init.body });
    assert.equal(url.hostname, "graph.facebook.com");
    const expectedToken = platform === "facebook" ? "test-only-facebook-token-123456789" : "test-only-instagram-token-123456789";
    if (url.pathname.endsWith("/debug_token")) {
      const inputToken = url.searchParams.get("input_token");
      const debugPlatform = inputToken === "test-only-facebook-token-123456789" ? "facebook" : "instagram";
      assert.equal(inputToken, debugPlatform === "facebook" ? "test-only-facebook-token-123456789" : "test-only-instagram-token-123456789");
      assert.equal(url.searchParams.get("access_token"), "test-meta-app-id|test-only-meta-app-secret-123456789");
      const scopes = debugPlatform === "facebook"
        ? ["pages_manage_posts", "pages_read_engagement", "pages_show_list", "instagram_basic"]
        : ["instagram_basic", "instagram_content_publish", "pages_show_list", "pages_read_engagement"];
      if (mode === "missing-scope" && debugPlatform === "facebook") scopes.splice(scopes.indexOf("pages_manage_posts"), 1);
      const appId = mode === "wrong-app" ? "different-meta-app-id" : "test-meta-app-id";
      const expiry = Math.floor(Date.now()/1000)+(mode === "expired-token" ? 3600 : 90*86400);
      return new Response(JSON.stringify({ data: {
        is_valid: true, app_id: appId, type: debugPlatform === "facebook" ? "PAGE" : "USER",
        expires_at: expiry,
        data_access_expires_at: expiry,
        scopes
      }}), { status: 200 });
    }
    const pageRequest = url.pathname.endsWith("/115226621594988") && method === "GET";
    const expectedRequestToken = pageRequest || url.pathname.endsWith("/photos") || url.pathname.endsWith("/115226621594988_123456")
      ? "test-only-facebook-token-123456789" : expectedToken;
    const token = method === "POST" ? init.body.get("access_token") : url.searchParams.get("access_token");
    const proof = method === "POST" ? init.body.get("appsecret_proof") : url.searchParams.get("appsecret_proof");
    assert.equal(token, expectedRequestToken);
    assert.match(proof || "", /^[a-f0-9]{64}$/);
    assert.equal(init.headers?.Authorization, undefined);
    if (pageRequest) {
      return new Response(JSON.stringify({ id: "115226621594988", name: "CEO", instagram_business_account: { id: mode === "wrong-ig-link" ? "17840000000000000" : "17841402949410977" } }), { status: 200 });
    }
    if (platform === "facebook") {
      if (method === "POST" && url.pathname.endsWith("/115226621594988/photos")) {
        assert.equal(init.body.get("published"), "true");
        assert.ok(init.body.get("caption").includes("#CEO_Notes"));
        return new Response(JSON.stringify({ id: "photo-123", post_id: "115226621594988_123456" }), { status: 200 });
      }
      if (method === "GET" && url.pathname.endsWith("/115226621594988_123456")) {
        if (mode === "readback-fail") return new Response(JSON.stringify({ error: { code: 190 } }), { status: 401 });
        return new Response(JSON.stringify({
          id: "115226621594988_123456",
          from: { id: "115226621594988" },
          permalink_url: "https://www.facebook.com/115226621594988_123456",
          is_published: true
        }), { status: 200 });
      }
    } else {
      if (method === "GET" && url.pathname.endsWith("/17841402949410977") && url.searchParams.get("fields")?.includes("username")) {
        return new Response(JSON.stringify({ id: "17841402949410977", username: "kiritoon" }), { status: 200 });
      }
      if (method === "POST" && url.pathname.endsWith("/17841402949410977/media")) {
        if (mode === "publish-fail") return new Response(JSON.stringify({ error: { code: 190 } }), { status: 401 });
        assert.ok(init.body.get("image_url").includes("/image/1"));
        return new Response(JSON.stringify({ id: "ig-container-1" }), { status: 200 });
      }
      if (method === "GET" && url.pathname.endsWith("/ig-container-1")) {
        return new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 });
      }
      if (method === "POST" && url.pathname.endsWith("/17841402949410977/media_publish")) {
        assert.equal(init.body.get("creation_id"), "ig-container-1");
        return new Response(JSON.stringify({ id: "17912345678901234" }), { status: 200 });
      }
      if (method === "GET" && url.pathname.endsWith("/17912345678901234")) {
        return new Response(JSON.stringify({
          id: "17912345678901234",
          owner: { id: "17841402949410977" },
          permalink: "https://www.instagram.com/p/AbC123/",
          timestamp: "2026-11-15T17:30:00+0000"
        }), { status: 200 });
      }
    }
    throw new Error("Unexpected Meta API request: " + method + " " + url.pathname);
  };
  try { return { result: await work(), requests }; }
  finally { globalThis.fetch = originalFetch; }
}

async function approvePost(env, generated, platform = "facebook", scheduledFor = null) {
  const identity = platform === "facebook" ? "ceo-page" : "ceo-notes";
  const body = {
    day: generated.post.day,
    platform,
    identity,
    contentHash: generated.contentHash,
    confirm: "APPROVE_CEO_NOTES_PUBLICATION",
    ...(scheduledFor ? { scheduledFor } : {})
  };
  const response = await call("/api/approval/approve", { method: "POST", headers: auth, body }, env);
  return { response, data: await response.json(), body };
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

test("editorial dashboard is inaccessible without Cloudflare Access and works for an Access-authenticated owner", async () => {
  const env = makeEnv();
  const anonymous = await worker.fetch(new Request("https://ceo-notes-ai-preview.workers.dev/admin"), env, {});
  assert.equal(anonymous.status, 401);
  const accessContext = { access: { async getIdentity() { return { email: "owner@example.invalid" }; } } };
  const page = await worker.fetch(new Request("https://ceo-notes-ai-preview.workers.dev/admin"), env, accessContext);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type"), /text\/html/);
  assert.match(await page.text(), /لوحة CEO Notes/);
  const api = await worker.fetch(new Request("https://ceo-notes-ai-preview.workers.dev/api/draft/status", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date: "2026-11-15" })
  }), env, accessContext);
  assert.equal(api.status, 200);
  assert.equal((await api.json()).draft, null);
});

test("editing a draft recomputes its hash and invalidates an image generated for the old content", async () => {
  const env = makeEnv();
  const generatedResponse = await call("/api/generate", { method: "POST", headers: auth, body: {} }, env);
  assert.equal(generatedResponse.status, 200);
  const generated = await generatedResponse.json();
  const imageResponse = await call("/api/image", {
    method: "POST", headers: auth,
    body: { date: generated.date, post: generated.post, imagePrompt: generated.imagePrompt }
  }, env);
  assert.equal(imageResponse.status, 200);
  assert.ok(await env.CEO_NOTES_KV.get("image:1"));
  const changedPost = { ...generated.post, title: generated.post.title + " - تعديل" };
  const updated = await call("/api/draft/update", {
    method: "POST", headers: auth,
    body: { date: generated.date, post: changedPost, imagePrompt: generated.imagePrompt }
  }, env);
  assert.equal(updated.status, 200);
  const data = await updated.json();
  assert.notEqual(data.contentHash, generated.contentHash);
  assert.equal(await env.CEO_NOTES_KV.get("image:1"), null);
  assert.equal(await env.CEO_NOTES_KV.get("image-meta:1"), null);
});

test("native social publishing is blocked until the owner approves the exact published content hash", async () => {
  const env = makeEnv();
  const { generated } = await createPublishedPost(env);
  const response = await call("/api/social/publish", {
    method: "POST", headers: auth,
    body: { day: 1, platform: "facebook", identity: "ceo-page", contentHash: generated.contentHash }
  }, env);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "owner_approval_required_for_exact_content");
  assert.equal(env.coordinatorValues.has("outbox:facebook:ceo-page:1"), false);
});

test("owner approval is explicit, idempotent and bound to the exact content hash", async () => {
  const env = makeEnv();
  const { generated } = await createPublishedPost(env);
  const missingConfirmation = await call("/api/approval/approve", {
    method: "POST", headers: auth,
    body: { day: 1, platform: "facebook", identity: "ceo-page", contentHash: generated.contentHash }
  }, env);
  assert.equal(missingConfirmation.status, 400);
  const approved = await approvePost(env, generated, "facebook");
  assert.equal(approved.response.status, 200);
  assert.equal(approved.data.approval.contentHash, generated.contentHash);
  assert.equal(approved.data.approval.approvedBy, "owner");
  const repeat = await approvePost(env, generated, "facebook");
  assert.equal(repeat.response.status, 200);
  assert.equal(repeat.data.idempotent, true);
  const stored = env.coordinatorValues.get("approval:facebook:ceo-page:1");
  assert.equal(stored.contentHash, generated.contentHash);
});

test("Facebook native publishing uploads the approved image, verifies Page identity and stores a successful outbox receipt", async () => {
  const env = makeEnv();
  const { generated } = await createPublishedPost(env);
  await approvePost(env, generated, "facebook");
  const { result, requests } = await withMetaPublish("facebook", () => call("/api/social/publish", {
    method: "POST", headers: auth,
    body: { day: 1, platform: "facebook", identity: "ceo-page", contentHash: generated.contentHash }
  }, env));
  assert.equal(result.status, 200, "Facebook publish response: " + JSON.stringify(await result.clone().json()) + " outbox: " + JSON.stringify(env.coordinatorValues.get("outbox:facebook:ceo-page:1")));
  const data = await result.json();
  assert.equal(data.status, "succeeded");
  assert.equal(data.postId, "115226621594988_123456");
  assert.equal(requests.length, 4);
  assert.equal(env.coordinatorValues.get("outbox:facebook:ceo-page:1").status, "succeeded");
  const duplicate = await call("/api/social/publish", {
    method: "POST", headers: auth,
    body: { day: 1, platform: "facebook", identity: "ceo-page", contentHash: generated.contentHash }
  }, env);
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).alreadyPublished, true);
});

test("Instagram native publishing waits for a finished container and verifies the pinned professional account", async () => {
  const env = makeEnv();
  const { generated } = await createPublishedPost(env);
  await approvePost(env, generated, "instagram");
  const { result, requests } = await withMetaPublish("instagram", () => call("/api/social/publish", {
    method: "POST", headers: auth,
    body: { day: 1, platform: "instagram", identity: "ceo-notes", contentHash: generated.contentHash }
  }, env));
  assert.equal(result.status, 200);
  const data = await result.json();
  assert.equal(data.status, "succeeded");
  assert.equal(data.postId, "17912345678901234");
  assert.equal(requests.length, 8);
  assert.equal(env.coordinatorValues.get("outbox:instagram:ceo-notes:1").status, "succeeded");
});

test("a remote publish followed by failed read-back becomes unknown and cannot be blindly retried", async () => {
  const env = makeEnv();
  const { generated } = await createPublishedPost(env);
  await approvePost(env, generated, "facebook");
  const { result: first, requests } = await withMetaPublish("facebook", () => call("/api/social/publish", {
    method: "POST", headers: auth,
    body: { day: 1, platform: "facebook", identity: "ceo-page", contentHash: generated.contentHash }
  }, env), "readback-fail");
  assert.equal(first.status, 502);
  assert.equal((await first.json()).manualReviewRequired, true);
  assert.equal(env.coordinatorValues.get("outbox:facebook:ceo-page:1").status, "unknown");
  const retry = await call("/api/social/publish", {
    method: "POST", headers: auth,
    body: { day: 1, platform: "facebook", identity: "ceo-page", contentHash: generated.contentHash }
  }, env);
  assert.equal(retry.status, 409);
  assert.equal(requests.filter(x => x.method === "POST" && x.path.endsWith("/photos")).length, 1);
});

test("Facebook and Instagram publication states remain independent after a partial channel failure", async () => {
  const env = makeEnv();
  const { generated } = await createPublishedPost(env);
  await approvePost(env, generated, "facebook");
  await approvePost(env, generated, "instagram");
  const facebook = await withMetaPublish("facebook", () => call("/api/social/publish", {
    method: "POST", headers: auth,
    body: { day: 1, platform: "facebook", identity: "ceo-page", contentHash: generated.contentHash }
  }, env));
  assert.equal(facebook.result.status, 200);
  const instagram = await withMetaPublish("instagram", () => call("/api/social/publish", {
    method: "POST", headers: auth,
    body: { day: 1, platform: "instagram", identity: "ceo-notes", contentHash: generated.contentHash }
  }, env), "publish-fail");
  assert.equal(instagram.result.status, 502);
  assert.equal(env.coordinatorValues.get("outbox:facebook:ceo-page:1").status, "succeeded");
  assert.equal(env.coordinatorValues.get("outbox:instagram:ceo-notes:1").status, "unknown");
});

test("Meta token preflight rejects expiry, wrong app and missing permissions before reserving", async () => {
  for (const [mode, expectedStatus, expectedError] of [
    ["expired-token", 409, "meta_token_expires_within_24_hours"],
    ["wrong-app", 401, "meta_token_invalid_or_wrong_app"],
    ["missing-scope", 403, "meta_permissions_missing"]
  ]) {
    const env = makeEnv();
    const { generated } = await createPublishedPost(env);
    await approvePost(env, generated, "facebook");
    const { result } = await withMetaPublish("facebook", () => call("/api/social/publish", {
      method: "POST", headers: auth,
      body: { day: 1, platform: "facebook", identity: "ceo-page", contentHash: generated.contentHash }
    }, env), mode);
    assert.equal(result.status, expectedStatus);
    assert.equal((await result.json()).error, expectedError);
    assert.equal(env.coordinatorValues.has("outbox:facebook:ceo-page:1"), false);
  }
});

test("Instagram publishing requires the pinned professional account to be linked to the CEO Page", async () => {
  const env = makeEnv();
  const { generated } = await createPublishedPost(env);
  await approvePost(env, generated, "instagram");
  const { result } = await withMetaPublish("instagram", () => call("/api/social/publish", {
    method: "POST", headers: auth,
    body: { day: 1, platform: "instagram", identity: "ceo-notes", contentHash: generated.contentHash }
  }, env), "wrong-ig-link");
  assert.equal(result.status, 409);
  assert.equal((await result.json()).error, "meta_instagram_account_not_linked_to_ceo_page");
  assert.equal(env.coordinatorValues.has("outbox:instagram:ceo-notes:1"), false);
});

test("native publishing requires the Meta App Secret for appsecret_proof before reserving an attempt", async () => {
  const env = makeEnv();
  const { generated } = await createPublishedPost(env);
  await approvePost(env, generated, "facebook");
  delete env.META_APP_SECRET;
  const response = await call("/api/social/publish", {
    method: "POST", headers: auth,
    body: { day: 1, platform: "facebook", identity: "ceo-page", contentHash: generated.contentHash }
  }, env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "meta_app_secret_unavailable");
  assert.equal(env.coordinatorValues.has("outbox:facebook:ceo-page:1"), false);
});

test("native publishing fails closed without Meta credentials and before reserving an outbox attempt", async () => {
  const env = makeEnv();
  const { generated } = await createPublishedPost(env);
  await approvePost(env, generated, "facebook");
  delete env.META_FACEBOOK_PAGE_ACCESS_TOKEN;
  const response = await call("/api/social/publish", {
    method: "POST", headers: auth,
    body: { day: 1, platform: "facebook", identity: "ceo-page", contentHash: generated.contentHash }
  }, env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "meta_credentials_unavailable");
  assert.equal(env.coordinatorValues.has("outbox:facebook:ceo-page:1"), false);
});

test("feed tampering that preserves a stale contentHash invalidates approval and publication", async () => {
  const env = makeEnv();
  const { generated } = await createPublishedPost(env);
  await approvePost(env, generated, "facebook");
  const feed = JSON.parse(await env.CEO_NOTES_KV.get("feed"));
  feed.posts[0].title = "تعديل غير معتمد على المحتوى";
  await env.CEO_NOTES_KV.put("feed", JSON.stringify(feed));
  const response = await call("/api/social/publish", {
    method: "POST", headers: auth,
    body: { day: 1, platform: "facebook", identity: "ceo-page", contentHash: generated.contentHash }
  }, env);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "content_hash_mismatch");
  assert.equal(env.coordinatorValues.has("outbox:facebook:ceo-page:1"), false);
});

test("production scheduler publishes only an approved due post at 19:30 Cairo time", async () => {
  const env = makeEnv();
  env.PUBLISHING_ENABLED = "true";
  const { generated } = await createPublishedPost(env);
  const scheduledIso = "2026-11-16T17:30:00.000Z";
  const scheduledTime = Date.parse(scheduledIso);
  await approvePost(env, generated, "facebook", scheduledIso);
  const originalNow = Date.now;
  Date.now = () => scheduledTime;
  try {
    const pending = [];
    const { requests } = await withMetaPublish("facebook", async () => {
      await worker.scheduled(
        { cron: "*/15 * * * *", scheduledTime },
        env,
        { waitUntil(promise) { pending.push(promise); } }
      );
      await Promise.all(pending);
    });
    assert.equal(requests.length, 4);
    assert.equal(env.coordinatorValues.get("outbox:facebook:ceo-page:1").status, "succeeded");
  } finally {
    Date.now = originalNow;
  }
});

test("scheduled publishing is disabled in Preview even when a flag is accidentally present", async () => {
  const env = makeEnv({ previewMode: true });
  env.PUBLISHING_ENABLED = "true";
  const pending = [];
  await worker.scheduled({ cron: "*/15 * * * *", scheduledTime: "2026-11-15T17:30:00.000Z" }, env, { waitUntil(promise) { pending.push(promise); } });
  assert.equal(pending.length, 0);
});

test("Preview AI generation and image routes fail closed when the AI binding is intentionally absent", async () => {
  const env = makeEnv({ previewMode: true });
  delete env.AI;
  const generate = await call("/api/generate", { method: "POST", headers: auth, body: {} }, env);
  assert.equal(generate.status, 503);
  assert.equal((await generate.json()).error, "ai_binding_unavailable");
  const image = await call("/api/image", { method: "POST", headers: auth, body: { date: "2026-11-15" } }, env);
  assert.equal(image.status, 503);
  assert.equal((await image.json()).error, "ai_binding_unavailable");
});

test("health and canonical feed remain public and health checks runtime bindings", async () => {
  const env = makeEnv();
  const healthResponse = await call("/health", {}, env);
  assert.equal(healthResponse.status, 200);
  const health = await healthResponse.json();
  assert.equal(health.ok, true);
  assert.equal(health.kvConfigured, true);
  assert.equal(health.outboxCoordinatorConfigured, true);
  assert.equal(health.outboxCoordinatorReady, true);
  const feed = await call("/feed", {}, env);
  assert.equal(feed.status, 200);
  assert.deepEqual((await feed.json()).posts, []);
});

test("preview mode never seeds its isolated KV from the production feed", async () => {
  const env = makeEnv();
  env.PREVIEW_MODE = "true";
  env.CEO_NOTES_KV.values.delete("feed");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("preview attempted production feed fetch"); };
  try {
    const response = await call("/feed", {}, env);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).posts, []);
    assert.deepEqual(JSON.parse(await env.CEO_NOTES_KV.get("feed")).posts, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test("concurrent same-day editorial generation is serialized by the Durable Object lock", async () => {
  const env = makeEnv();
  const originalRun = env.AI.run.bind(env.AI);
  env.AI.run = async (model, input) => {
    if (!model.includes("flux")) await new Promise(resolve => setTimeout(resolve, 25));
    return originalRun(model, input);
  };
  const responses = await Promise.all([
    call("/api/generate", { method: "POST", headers: auth, body: {} }, env),
    call("/api/generate", { method: "POST", headers: auth, body: {} }, env)
  ]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  assert.equal(env.calls.text, 1);
  const retry = await call("/api/generate", { method: "POST", headers: auth, body: {} }, env);
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).reused, true);
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


test("preview public image URLs use the configured preview Worker origin", async () => {
  const env = makeEnv();
  env.PUBLIC_BASE = "https://ceo-notes-ai-preview.example.workers.dev";
  const { generated, image, publish } = await createPublishedPost(env);
  assert.equal(image.imageUrl, env.PUBLIC_BASE + "/image/1");
  const feed = JSON.parse(await env.CEO_NOTES_KV.get("feed"));
  assert.equal(feed.posts[0].imageUrl, env.PUBLIC_BASE + "/image/1");
  assert.equal(publish.alreadyPublished, false);
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
  const cannotClearReceipt = await call("/api/outbox/reconcile", {
    method: "POST", headers: auth, body: { ...base, action: "not_published", verificationSource: "facebook_graph_api", verificationStatus: "not_found" }
  }, env);
  assert.equal(cannotClearReceipt.status, 409);
  const blockedBeforeVerification = await call("/api/outbox/reserve", { method: "POST", headers: auth, body: base }, env);
  assert.equal(blockedBeforeVerification.status, 409);
  const rejectedVerification = await withMetaReadBack({
    id: "123_456", from: { id: "101823889330644" }, permalink_url: "https://www.facebook.com/123_456", is_published: true
  }, () => call("/api/outbox/verify", {
    method: "POST", headers: auth, body: { ...base, verified: true, verifiedPostId: "123_456", verifiedPermalink: "https://www.facebook.com/123_456", verifiedTargetId: "115226621594988", verificationSource: "facebook_graph_api", verificationStatus: "published" }
  }, env));
  assert.equal(rejectedVerification.status, 409);
  const verify = await withMetaReadBack({
    id: "123_456", from: { id: "115226621594988" }, permalink_url: "https://www.facebook.com/123_456", is_published: true
  }, () => call("/api/outbox/verify", {
    method: "POST", headers: auth, body: { ...base }
  }, env));
  assert.equal(verify.status, 200);
  assert.equal((await verify.json()).status, "succeeded");
  const retry = await call("/api/outbox/reserve", { method: "POST", headers: auth, body: base }, env);
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).decision, "skip");
  const stored = env.coordinatorValues.get("outbox:facebook:ceo-page:1");
  assert.equal(stored.postId, "123_456");
  assert.equal(stored.permalink, "https://www.facebook.com/123_456");
});

test("Instagram verification reads back the media owner and permalink from Meta", async () => {
  const env = makeEnv();
  const { generated } = await createPublishedPost(env);
  const base = { day: generated.post.day, platform: "instagram", identity: "ceo-notes", contentHash: generated.contentHash };
  await call("/api/outbox/reserve", { method: "POST", headers: auth, body: base }, env);
  await call("/api/outbox/start", { method: "POST", headers: auth, body: base }, env);
  await call("/api/outbox/receipt", {
    method: "POST", headers: auth,
    body: { ...base, postId: "17912345678901234", permalink: "https://www.instagram.com/p/AbC123/" }
  }, env);
  const response = await withMetaReadBack({
    id: "17912345678901234", owner: { id: "17841402949410977" },
    permalink: "https://www.instagram.com/p/AbC123/", timestamp: "2026-11-15T17:30:00+0000"
  }, () => call("/api/outbox/verify", { method: "POST", headers: auth, body: base }, env), "instagram");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "succeeded");
  assert.equal(env.coordinatorValues.get("outbox:instagram:ceo-notes:1").verifiedTargetId, "17841402949410977");
});

test("Meta verification fails closed when the Worker secret is missing", async () => {
  const env = makeEnv();
  const { generated } = await createPublishedPost(env);
  const base = { day: generated.post.day, platform: "facebook", identity: "ceo-page", contentHash: generated.contentHash };
  await call("/api/outbox/reserve", { method: "POST", headers: auth, body: base }, env);
  await call("/api/outbox/start", { method: "POST", headers: auth, body: base }, env);
  await call("/api/outbox/receipt", { method: "POST", headers: auth, body: { ...base, postId: "123_456", permalink: "https://www.facebook.com/123_456" } }, env);
  delete env.META_FACEBOOK_PAGE_ACCESS_TOKEN;
  const response = await call("/api/outbox/verify", { method: "POST", headers: auth, body: base }, env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "meta_credentials_unavailable");
  assert.equal(env.coordinatorValues.get("outbox:facebook:ceo-page:1").status, "receipt_recorded");
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
    method: "POST", headers: auth, body: { ...base, action: "not_published", verifiedTargetId: "17841402949410977", verificationSource: "instagram_graph_api", verificationStatus: "not_found" }
  }, env);
  assert.equal(reconcile.status, 409);
  assert.equal((await reconcile.json()).error, "authoritative_absence_check_required");
  const stillBlocked = await call("/api/outbox/reserve", { method: "POST", headers: auth, body: base }, env);
  assert.equal(stillBlocked.status, 409);
  assert.equal((await stillBlocked.json()).status, "unknown");
});

test("abandoned reservation requires explicit not-published reconciliation before retry", async () => {
  const env = makeEnv();
  const { generated } = await createPublishedPost(env);
  const base = { day: generated.post.day, platform: "facebook", identity: "ceo-page", contentHash: generated.contentHash };
  const first = await call("/api/outbox/reserve", { method: "POST", headers: auth, body: base }, env);
  assert.equal(first.status, 200);
  const blocked = await call("/api/outbox/reserve", { method: "POST", headers: auth, body: base }, env);
  assert.equal(blocked.status, 409);
  const reconcile = await call("/api/outbox/reconcile", {
    method: "POST", headers: auth, body: { ...base, action: "not_published" }
  }, env);
  assert.equal(reconcile.status, 200);
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


test("outbox coordinator receives normalized validated context fields", async () => {
  const env = makeEnv();
  const { generated } = await createPublishedPost(env);
  const response = await call("/api/outbox/reserve", {
    method: "POST",
    headers: auth,
    body: { day: String(generated.post.day), platform: "facebook", identity: "ceo-page", contentHash: generated.contentHash }
  }, env);
  assert.equal(response.status, 200);
  const expected = env.coordinatorValues.get("outbox:facebook:ceo-page:1");
  assert.equal(expected.day, generated.post.day);
  assert.equal(typeof expected.day, "number");
  assert.equal(expected.platform, "facebook");
  assert.equal(expected.identity, "ceo-page");
  assert.equal(expected.contentHash, generated.contentHash);
  assert.equal(expected.targetId, "115226621594988");
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


test("outbox target identity is pinned server-side and cannot be supplied by the caller", async () => {
  const env = makeEnv();
  const { generated } = await createPublishedPost(env);
  const base = { day: generated.post.day, platform: "facebook", identity: "ceo-page", contentHash: generated.contentHash, targetId: "999999999999999" };
  const reserve = await call("/api/outbox/reserve", { method: "POST", headers: auth, body: base }, env);
  assert.equal(reserve.status, 200);
  const stored = env.coordinatorValues.get("outbox:facebook:ceo-page:1");
  assert.equal(stored.targetId, "115226621594988");
});

test("outbox verification rejects a post found under a different Facebook identity", async () => {
  const env = makeEnv();
  const { generated } = await createPublishedPost(env);
  const base = { day: generated.post.day, platform: "facebook", identity: "ceo-page", contentHash: generated.contentHash };
  await call("/api/outbox/reserve", { method: "POST", headers: auth, body: base }, env);
  await call("/api/outbox/start", { method: "POST", headers: auth, body: base }, env);
  await call("/api/outbox/receipt", {
    method: "POST", headers: auth,
    body: { ...base, postId: "123_456", permalink: "https://www.facebook.com/123_456" }
  }, env);
  const wrongIdentity = await withMetaReadBack({
    id: "123_456", from: { id: "101823889330644" }, permalink_url: "https://www.facebook.com/123_456", is_published: true
  }, () => call("/api/outbox/verify", { method: "POST", headers: auth, body: { ...base } }, env));
  assert.equal(wrongIdentity.status, 409);
  const correctIdentity = await withMetaReadBack({
    id: "123_456", from: { id: "115226621594988" }, permalink_url: "https://www.facebook.com/123_456", is_published: true
  }, () => call("/api/outbox/verify", { method: "POST", headers: auth, body: { ...base } }, env));
  assert.equal(correctIdentity.status, 200);
});


test("API Worker root is JSON-only and never fetches HTML from the Royal Egypt main branch", async () => {
  const env = makeEnv();
  env.PREVIEW_MODE = "true";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("root route attempted external HTML fetch"); };
  try {
    const response = await call("/", {}, env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, service: "CEO Notes AI Publisher", mode: "preview" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("backup restore is preview-only, verifies checksums and restores KV plus coordinator outbox state", async () => {
  const source = makeEnv({ previewMode: true });
  const { generated } = await createPublishedPost(source);
  const base = { day: generated.post.day, platform: "facebook", identity: "ceo-page", contentHash: generated.contentHash };
  await call("/api/outbox/reserve", { method: "POST", headers: auth, body: base }, source);
  const pending = [];
  worker.scheduled({ scheduledTime: Date.parse("2026-11-12T02:00:00.000Z") }, source, {
    waitUntil(promise) { pending.push(promise); }
  });
  await Promise.all(pending);

  const backupSeed = Object.fromEntries([...source.CEO_NOTES_KV.values.entries()].filter(([key]) => key.startsWith("backup:")));
  const target = makeEnv({ previewMode: true, seedKV: backupSeed });
  const restoreBody = { date: "2026-11-12", confirm: "RESTORE_PREVIEW_BACKUP" };
  const restoredResponse = await call("/api/backup/restore", { method: "POST", headers: auth, body: restoreBody }, target);
  assert.equal(restoredResponse.status, 200);
  const restored = await restoredResponse.json();
  assert.equal(restored.previewOnly, true);
  assert.equal(restored.feedPosts, 1);
  assert.equal(await target.CEO_NOTES_KV.get("image:1"), await source.CEO_NOTES_KV.get("backup:2026-11-12:image:1"));
  assert.equal(await target.CEO_NOTES_KV.get("image-meta:1"), await source.CEO_NOTES_KV.get("backup:2026-11-12:image-meta:1"));
  assert.equal(await target.CEO_NOTES_KV.get("feed"), await source.CEO_NOTES_KV.get("backup:2026-11-12:feed"));
  assert.equal(target.coordinatorValues.get("outbox:facebook:ceo-page:1").status, "reserved");

  const repeated = await call("/api/backup/restore", { method: "POST", headers: auth, body: restoreBody }, target);
  assert.equal(repeated.status, 200);
  assert.equal((await repeated.json()).coordinatorOutbox, 1);
});

test("backup restore rejects production mode before reading or writing backup data", async () => {
  const env = makeEnv();
  const response = await call("/api/backup/restore", {
    method: "POST",
    headers: auth,
    body: { date: "2026-11-12", confirm: "RESTORE_PREVIEW_BACKUP" }
  }, env);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "preview_restore_only");
  assert.equal((await env.CEO_NOTES_KV.get("feed")), JSON.stringify({ version: 1, posts: [] }));
});

test("backup restore rejects tampered backup data without partial writes", async () => {
  const source = makeEnv({ previewMode: true });
  await createPublishedPost(source);
  const pending = [];
  worker.scheduled({ scheduledTime: Date.parse("2026-11-12T02:00:00.000Z") }, source, {
    waitUntil(promise) { pending.push(promise); }
  });
  await Promise.all(pending);
  const backupSeed = Object.fromEntries([...source.CEO_NOTES_KV.values.entries()].filter(([key]) => key.startsWith("backup:")));
  backupSeed["backup:2026-11-12:feed"] = "tampered";
  const target = makeEnv({ previewMode: true, seedKV: backupSeed });
  const response = await call("/api/backup/restore", {
    method: "POST",
    headers: auth,
    body: { date: "2026-11-12", confirm: "RESTORE_PREVIEW_BACKUP" }
  }, target);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "backup_feed_checksum_failed");
  assert.equal(JSON.parse(await target.CEO_NOTES_KV.get("feed")).posts.length, 0);
  assert.equal(target.coordinatorValues.size, 0);
});

test("backup restore refuses unrelated pre-existing preview keys", async () => {
  const source = makeEnv({ previewMode: true });
  await createPublishedPost(source);
  const pending = [];
  worker.scheduled({ scheduledTime: Date.parse("2026-11-12T02:00:00.000Z") }, source, {
    waitUntil(promise) { pending.push(promise); }
  });
  await Promise.all(pending);
  const backupSeed = Object.fromEntries([...source.CEO_NOTES_KV.values.entries()].filter(([key]) => key.startsWith("backup:")));
  backupSeed["image:999"] = "unrelated-preview-state";
  const target = makeEnv({ previewMode: true, seedKV: backupSeed });
  const response = await call("/api/backup/restore", {
    method: "POST",
    headers: auth,
    body: { date: "2026-11-12", confirm: "RESTORE_PREVIEW_BACKUP" }
  }, target);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "preview_target_not_empty");
  assert.equal(JSON.parse(await target.CEO_NOTES_KV.get("feed")).posts.length, 0);
  assert.equal(target.coordinatorValues.size, 0);
});

