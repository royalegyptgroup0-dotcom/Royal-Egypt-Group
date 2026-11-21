import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./worker.js", import.meta.url), "utf8");
const worker = (await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"))).default;
const routeSuffix = "a".repeat(64);
const GEN_PATH = "/generate-" + routeSuffix;
const IMAGE_PATH = "/image-" + routeSuffix;
const PUBLISH_PATH = "/publish-" + routeSuffix;
const token = "test-only-admin-token-with-at-least-32-characters";
const env = {
  ADMIN_TOKEN: token,
  LEGACY_ROUTE_SUFFIX: routeSuffix,
  CEO_NOTES_KV: {
    async get(key) { return key === "feed" ? JSON.stringify({ version: 1, posts: [] }) : null; },
    async put() {},
  },
};

async function call(path, { method = "GET", headers = {}, body } = {}, bindings = {}) {
  return worker.fetch(new Request("https://worker.test" + path, {
    method,
    headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { ...env, ...bindings });
}

test("health endpoint remains public", async () => {
  const response = await call("/health");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
});

test("public feed remains readable", async () => {
  const response = await call("/feed");
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).posts, []);
});

test("generation, image generation and publishing reject missing bearer auth", async () => {
  assert.equal((await call(GEN_PATH, { method: "POST", body: {} })).status, 401);
  assert.equal((await call(IMAGE_PATH + "?day=28&title=test&article=test")).status, 401);
  assert.equal((await call(IMAGE_PATH, { method: "POST", body: { day: 28, title: "test", article: "test" } })).status, 401);
  assert.equal((await call(PUBLISH_PATH, { method: "POST", body: {} })).status, 401);
  assert.equal((await call(PUBLISH_PATH)).status, 401);
});

test("admin routes fail closed when ADMIN_TOKEN is not configured", async () => {
  assert.equal((await call(GEN_PATH, { method: "POST", body: {} }, { ADMIN_TOKEN: undefined })).status, 401);
  assert.equal((await call(PUBLISH_PATH, {}, { ADMIN_TOKEN: undefined })).status, 401);
});


test("image generation accepts authenticated POST JSON and preserves legacy GET compatibility", async () => {
  const values = new Map([["feed", JSON.stringify({ version: 1, posts: [] })]]);
  const kv = {
    async get(key) { return values.has(key) ? values.get(key) : null; },
    async put(key, value) { values.set(key, value); },
  };
  const ai = { async run(model, input) {
    assert.equal(model, "@cf/black-forest-labs/flux-1-schnell");
    assert.ok(input.prompt.length > 0);
    return { image: "aGVsbG8=", usage: { neurons: 1 } };
  }};
  const body = {
    date: "2026-11-21",
    post: {
      day: 28, title: "عنوان تجريبي للمراجعة", article: "نص تجريبي للصورة",
      ideaOfTheDay: "فكرة", ceoChallenge: "تحدي", discussionQuestion: "سؤال",
      hashtags: ["#CEO_Notes", "#اختبار"]
    },
    imagePrompt: "Editorial image, no text."
  };
  const postResponse = await call(IMAGE_PATH, {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body
  }, { AI: ai, CEO_NOTES_KV: kv });
  assert.equal(postResponse.status, 200);
  const postData = await postResponse.json();
  assert.equal(postData.post.day, 28);
  assert.equal(postData.post.hashtags, "#CEO_Notes #اختبار");
  assert.equal(values.get("image:28"), "aGVsbG8=");

  const legacyResponse = await call(
    IMAGE_PATH + "?day=29&title=legacy&article=legacy&imagePrompt=Legacy%20test",
    { method: "GET", headers: { Authorization: "Bearer " + token } },
    { AI: ai, CEO_NOTES_KV: kv }
  );
  assert.equal(legacyResponse.status, 200);
  assert.equal(values.get("image:29"), "aGVsbG8=");
});

test("legacy route suffix is required and malformed values fail closed", async () => {
  const noSuffix = await call(GEN_PATH, {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: {}
  }, { LEGACY_ROUTE_SUFFIX: undefined });
  assert.equal(noSuffix.status, 404);
  const malformed = await call(GEN_PATH, {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: {}
  }, { LEGACY_ROUTE_SUFFIX: "../not-a-secret" });
  assert.equal(malformed.status, 404);
});

test("valid bearer token passes the authorization gate", async () => {
  const response = await call(PUBLISH_PATH, {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: {},
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "invalid_publish_payload_or_image_missing");
});
