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
const env = {
  ADMIN_TOKEN: token,
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
  assert.equal((await call(PUBLISH_PATH, { method: "POST", body: {} })).status, 401);
  assert.equal((await call(PUBLISH_PATH)).status, 401);
});

test("admin routes fail closed when ADMIN_TOKEN is not configured", async () => {
  assert.equal((await call(GEN_PATH, { method: "POST", body: {} }, { ADMIN_TOKEN: undefined })).status, 401);
  assert.equal((await call(PUBLISH_PATH, {}, { ADMIN_TOKEN: undefined })).status, 401);
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
