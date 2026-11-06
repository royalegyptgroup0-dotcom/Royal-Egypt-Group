import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/intake.js";

const origin = "https://release-royal-eg-release-can.royalegyptgroup.pages.dev";
const webhook = "https://hook.eu1.make.com/test-placeholder";
const validPayload = {
  name: "Synthetic Test",
  phone: "+0000000000",
  email: "preview-test@example.invalid",
  request_type: "customer",
  location: "Suez",
  details: "Synthetic integration test only.",
  language: "en",
  consent: true,
  website: ""
};

function makeRequest(payload = validPayload, requestOrigin = origin) {
  return new Request("https://release-royal-eg-release-can.royalegyptgroup.pages.dev/api/intake", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "origin": requestOrigin
    },
    body: JSON.stringify(payload)
  });
}

async function withFetch(mock, callback) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await callback();
  } finally {
    globalThis.fetch = original;
  }
}

test("rejects an untrusted Origin without calling Make", async () => {
  let called = false;
  const response = await withFetch(async () => {
    called = true;
    return new Response("unexpected", { status: 200 });
  }, () => onRequest({
    request: makeRequest(validPayload, "https://attacker.example"),
    env: { MAKE_INTAKE_WEBHOOK_URL: webhook }
  }));
  assert.equal(response.status, 403);
  assert.equal(called, false);
});

test("rejects a missing webhook secret", async () => {
  const response = await onRequest({
    request: makeRequest(),
    env: {}
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "intake_not_configured");
});

test("rejects a webhook URL outside the trusted Make host", async () => {
  const response = await onRequest({
    request: makeRequest(),
    env: { MAKE_INTAKE_WEBHOOK_URL: "https://attacker.example/collect" }
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "intake_configuration_invalid");
});

test("rejects missing consent without forwarding", async () => {
  let called = false;
  const response = await withFetch(async () => {
    called = true;
    return new Response("unexpected", { status: 200 });
  }, () => onRequest({
    request: makeRequest({ ...validPayload, consent: false }),
    env: { MAKE_INTAKE_WEBHOOK_URL: webhook }
  }));
  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test("rejects a filled honeypot without forwarding", async () => {
  let called = false;
  const response = await withFetch(async () => {
    called = true;
    return new Response("unexpected", { status: 200 });
  }, () => onRequest({
    request: makeRequest({ ...validPayload, website: "bot-filled" }),
    env: { MAKE_INTAKE_WEBHOOK_URL: webhook }
  }));
  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test("accepts a synthetic customer request and forwards only approved fields", async () => {
  let forwarded;
  const response = await withFetch(async (url, init) => {
    assert.equal(url, webhook);
    assert.equal(init.method, "POST");
    forwarded = JSON.parse(init.body);
    return new Response("ok", { status: 200 });
  }, () => onRequest({
    request: makeRequest(),
    env: { MAKE_INTAKE_WEBHOOK_URL: webhook }
  }));

  assert.equal(response.status, 202);
  const result = await response.json();
  assert.equal(result.accepted, true);
  assert.match(result.reference, /^[0-9a-f-]{36}$/i);
  assert.equal(forwarded.request_type, "customer");
  assert.equal(forwarded.status, "new");
  assert.equal(forwarded.name, "Synthetic Test");
  assert.equal(forwarded.website, undefined);
});

test("listing offers are always marked pending review", async () => {
  let forwarded;
  const response = await withFetch(async (_url, init) => {
    forwarded = JSON.parse(init.body);
    return new Response("ok", { status: 200 });
  }, () => onRequest({
    request: makeRequest({ ...validPayload, request_type: "listing" }),
    env: { MAKE_INTAKE_WEBHOOK_URL: webhook }
  }));

  assert.equal(response.status, 202);
  assert.equal(forwarded.status, "pending_review");
});
