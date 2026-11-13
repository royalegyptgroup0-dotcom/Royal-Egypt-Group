import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./worker.js", import.meta.url), "utf8");
const worker = (await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"))).default;
const route = (name) => source.match(new RegExp(name + '="([^"]+)"'))?.[1];
const GEN_PATH = route("GEN_PATH");
const IMAGE_PATH = route("IMAGE_PATH");
const PUBLISH_PATH = route("PUBLISH_PATH");
const token = "test-only-admin-token-with-at-least-32-characters";

function fixture(adminToken = token) {
  const values = new Map([["feed", JSON.stringify({ version: 1, posts: [] })]]);
  const writes = [];
  const aiCalls = [];
  const env = {
    ADMIN_TOKEN: adminToken,
    CEO_NOTES_KV: {
      async get(key) { return values.has(key) ? values.get(key) : null; },
      async put(key, value) { values.set(key, String(value)); writes.push(key); },
    },
    AI: {
      async run(model, input) {
        aiCalls.push({ model, input });
        if (model === "@cf/black-forest-labs/flux-1-schnell") {
          return { image: "aGVsbG8=", usage: { neurons: 1 } };
        }
        throw new Error("unexpected_ai_model");
      },
    },
  };
  return { env, values, writes, aiCalls };
}

async function call(f, path, { method = "GET", headers = {}, body } = {}, bindings = {}) {
  const request = new Request("https://worker.test" + path, {
    method,
    headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return worker.fetch(request, { ...f.env, ...bindings });
}

const validPost = {
  day: 28,
  title: "اختبار تفويض المسؤولية",
  article: "مقال اختباري ".repeat(60),
  ideaOfTheDay: "التفويض تمكين.",
  ceoChallenge: "فوض مهمة واحدة خلال 48 ساعة.",
  discussionQuestion: "كيف توازن بين المتابعة والثقة؟",
  hashtags: "#CEO_Notes #إدارة #قيادة",
};

test("health endpoint remains public without ADMIN_TOKEN", async () => {
  const f = fixture(undefined);
  const response = await call(f, "/health");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
});

test("public feed remains readable", async () => {
  const f = fixture(undefined);
  const response = await call(f, "/feed");
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).posts, []);
});

test("generation, image generation and publishing reject missing bearer auth", async () => {
  const f = fixture();
  assert.equal((await call(f, GEN_PATH, { method: "POST", body: {} })).status, 401);
  assert.equal((await call(f, IMAGE_PATH, { method: "POST", body: { post: validPost } })).status, 401);
  assert.equal((await call(f, PUBLISH_PATH, { method: "POST", body: {} })).status, 401);
});

test("admin POST routes fail closed when ADMIN_TOKEN is not configured", async () => {
  const f = fixture(undefined);
  assert.equal((await call(f, GEN_PATH, { method: "POST", body: {} })).status, 401);
  assert.equal((await call(f, IMAGE_PATH, { method: "POST", body: { post: validPost } })).status, 401);
  assert.equal((await call(f, PUBLISH_PATH, { method: "POST", body: {} })).status, 401);
});

test("legacy GET mutation methods are rejected without side effects", async () => {
  const f = fixture();
  const headers = { Authorization: "Bearer " + token };
  const image = await call(f, IMAGE_PATH + "?day=28&title=legacy&article=legacy", { headers });
  const publish = await call(f, PUBLISH_PATH, { headers });
  assert.equal(image.status, 405);
  assert.equal(publish.status, 405);
  assert.equal(f.aiCalls.length, 0);
  assert.deepEqual(f.writes, []);
});

test("image generation accepts authenticated POST JSON and stores the generated image", async () => {
  const f = fixture();
  const response = await call(f, IMAGE_PATH, {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: { post: validPost, imagePrompt: "A neutral editorial office portrait." },
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.post.day, 28);
  assert.equal(data.post.status, "Published");
  assert.equal(data.imageUrl.endsWith("/image/28"), true);
  assert.equal(f.values.get("image:28"), "aGVsbG8=");
  assert.deepEqual(f.writes, ["image:28"]);
});

test("generated images remain publicly retrievable through the read-only image route", async () => {
  const f = fixture(undefined);
  f.values.set("image:28", "aGVsbG8=");
  const response = await call(f, "/image/28");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/jpeg");
  assert.equal(await response.text(), "hello");
});

test("publishing accepts authenticated POST JSON and stores the article in the feed", async () => {
  const f = fixture();
  f.values.set("image:28", "aGVsbG8=");
  const response = await call(f, PUBLISH_PATH, {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: { post: validPost },
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
  const feed = JSON.parse(f.values.get("feed"));
  assert.equal(feed.posts.length, 1);
  assert.equal(feed.posts[0].day, 28);
  assert.equal(feed.posts[0].status, "Published");
});

test("valid bearer auth reaches publish validation", async () => {
  const f = fixture();
  const response = await call(f, PUBLISH_PATH, {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: {},
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "invalid_publish_payload_or_image_missing");
});
