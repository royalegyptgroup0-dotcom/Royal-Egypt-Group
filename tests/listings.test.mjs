import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/listings.js";

class FakeDB {
  constructor() {
    this.approved = [{ id: "public-1", title: "Approved listing", status: "approved", images: "[]" }];
    this.records = [];
    this.rateLimits = new Map();
  }

  prepare(sql) {
    return {
      all: async () => ({ results: this.approved }),
      bind: (...values) => ({
        first: async () => {
          const [ipHash, windowStart] = values;
          const previous = this.rateLimits.get(ipHash);
          const count = previous && previous.windowStart === windowStart ? previous.count + 1 : 1;
          this.rateLimits.set(ipHash, { windowStart, count });
          return { request_count: count };
        },
        run: async () => {
          if (sql.includes("INSERT INTO listings")) {
            this.records.push({ sql, values });
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 1 } };
        },
      }),
    };
  }
}

function makeForm(overrides = {}) {
  const form = new FormData();
  const values = {
    contact_name: "Synthetic Owner",
    contact_phone: "+201000000000",
    title: "Synthetic property test",
    property_type: "شقة",
    location: "Suez",
    area_sqm: "120",
    price: "",
    purpose: "بيع",
    description: "Synthetic test listing only; do not publish.",
    consent: "on",
    website: "",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

function makeRequest(overrides = {}, ip = "198.51.100.10", origin = "https://preview-branch.royalegyptgroup-vy7.pages.dev") {
  return new Request("https://preview-branch.royalegyptgroup-vy7.pages.dev/api/listings", {
    method: "POST",
    headers: {
      origin,
      "cf-connecting-ip": ip,
    },
    body: makeForm(overrides),
  });
}

test("public GET returns approved listings only and strips image payloads", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: new Request("https://preview-branch.royalegyptgroup-vy7.pages.dev/api/listings"),
    env: { DB: db },
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.listings.length, 1);
  assert.deepEqual(result.listings[0].images, []);
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("rejects POST requests from untrusted origins", async () => {
  const response = await onRequest({
    request: makeRequest({}, "198.51.100.10", "https://attacker.example"),
    env: { DB: new FakeDB() },
  });
  assert.equal(response.status, 403);
});

test("rejects a missing consent checkbox", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: makeRequest({ consent: "" }),
    env: { DB: db },
  });
  assert.equal(response.status, 400);
  assert.equal(db.records.length, 0);
});

test("rejects a filled honeypot without writing", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: makeRequest({ website: "bot-filled" }),
    env: { DB: db },
  });
  assert.equal(response.status, 400);
  assert.equal(db.records.length, 0);
});

test("rejects invalid phone numbers", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: makeRequest({ contact_phone: "abc" }),
    env: { DB: db },
  });
  assert.equal(response.status, 400);
  assert.equal(db.records.length, 0);
});

test("rejects unsupported property types", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: makeRequest({ property_type: "untrusted-type" }),
    env: { DB: db },
  });
  assert.equal(response.status, 400);
  assert.equal(db.records.length, 0);
});

test("rejects uploaded images until secure R2 storage is implemented", async () => {
  const db = new FakeDB();
  const form = makeForm();
  form.set("images", new File(["synthetic"], "test.png", { type: "image/png" }));
  const request = new Request("https://preview-branch.royalegyptgroup-vy7.pages.dev/api/listings", {
    method: "POST",
    headers: { origin: "https://preview-branch.royalegyptgroup-vy7.pages.dev", "cf-connecting-ip": "198.51.100.10" },
    body: form,
  });
  const response = await onRequest({ request, env: { DB: db } });
  assert.equal(response.status, 400);
  assert.equal(db.records.length, 0);
});

test("stores a valid listing as pending and never publishes it automatically", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: makeRequest(),
    env: { DB: db },
  });
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.status, "pending");
  assert.equal(db.records.length, 1);
  assert.match(db.records[0].sql, /'pending'/);
});


test("accepts the live Production Pages origin", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: makeRequest({}, "198.51.100.12", "https://royalegyptgroup-vy7.pages.dev"),
    env: { DB: db },
  });
  assert.equal(response.status, 201);
  assert.equal(db.records.length, 1);
});

test("limits each IP to ten listing submissions per minute", async () => {
  const db = new FakeDB();
  const responses = [];
  for (let i = 0; i < 11; i += 1) {
    responses.push(await onRequest({
      request: makeRequest({ title: "Synthetic listing " + i }),
      env: { DB: db },
    }));
  }
  assert.deepEqual(responses.map(response => response.status), [
    201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 429,
  ]);
  assert.equal(db.records.length, 10);
});

test("fails closed when the shared rate-limit table is unavailable", async () => {
  const db = {
    prepare() {
      return { bind() { return { first: async () => { throw new Error("synthetic D1 failure"); } }; } };
    },
  };
  const response = await onRequest({ request: makeRequest(), env: { DB: db } });
  assert.equal(response.status, 503);
});

test("rejects oversized multipart bodies before parsing", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: makeRequest({ description: "x".repeat(12_000) }),
    env: { DB: db },
  });
  assert.equal(response.status, 413);
  assert.equal(db.records.length, 0);
});


test("rejects oversized streaming bodies even when Content-Length is absent", async () => {
  const db = new FakeDB();
  const encoder = new TextEncoder();
  const chunks = [encoder.encode("x".repeat(6_000)), encoder.encode("y".repeat(6_000))];
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  const request = new Request("https://preview-branch.royalegyptgroup-vy7.pages.dev/api/listings", {
    method: "POST",
    headers: {
      origin: "https://preview-branch.royalegyptgroup-vy7.pages.dev",
      "cf-connecting-ip": "198.51.100.11",
      "content-type": "multipart/form-data; boundary=synthetic",
    },
    body,
    duplex: "half",
  });
  assert.equal(request.headers.has("content-length"), false);
  const response = await onRequest({ request, env: { DB: db } });
  assert.equal(response.status, 413);
  assert.equal(db.records.length, 0);
});\n
test("accepts apex and www custom-domain origins for listing submissions", async () => {
  for (const origin of ["https://royalegyptgroup.com", "https://www.royalegyptgroup.com"]) {
    const db = new FakeDB();
    const response = await onRequest({
      request: makeRequest({}, "198.51.100.13", origin),
      env: { DB: db },
    });
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.equal(db.records.length, 1);
  }
});
