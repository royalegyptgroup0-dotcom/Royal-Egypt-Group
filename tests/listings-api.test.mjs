import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/listings.js";

const origin = "https://royalegyptgroup-vy7.pages.dev";

class FakeDB {
  constructor() {
    this.rows = [];
    this.rateLimits = new Map();
  }

  prepare(sql) {
    return {
      all: async () => {
        if (sql.includes("WHERE status='approved'")) {
          return { results: this.rows.filter(row => row.status === "approved") };
        }
        return { results: [] };
      },
      bind: (...values) => ({
        first: async () => {
          if (!sql.includes("intake_rate_limits")) return null;
          const [ipHash, windowStart] = values;
          const previous = this.rateLimits.get(ipHash);
          const count = previous && previous.windowStart === windowStart
            ? previous.count + 1
            : 1;
          this.rateLimits.set(ipHash, { windowStart, count });
          return { request_count: count };
        },
        run: async () => {
          if (sql.includes("INSERT INTO listings")) {
            this.rows.push({
              id: values[0],
              contact_name: values[1],
              contact_phone: values[2],
              title: values[3],
              property_type: values[4],
              location: values[5],
              area_sqm: values[6],
              price: values[7],
              purpose: values[8],
              description: values[9],
              images: values[10],
              status: "pending",
              created_at: "2026-11-13 00:00:00"
            });
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        }
      })
    };
  }
}

function makeForm(overrides = {}) {
  const form = new FormData();
  const values = {
    contact_name: "Synthetic Listing Test",
    contact_phone: "+20 100 000 0000",
    title: "Synthetic Preview Property",
    property_type: "أرض",
    location: "Suez",
    area_sqm: "250",
    price: "Not specified",
    purpose: "بيع",
    description: "Synthetic data only. Do not contact.",
    consent: "on",
    website: "",
    ...overrides
  };
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) form.set(key, String(value));
  }
  return form;
}

function request({ method = "POST", form, requestOrigin = origin, ip = "198.51.100.9" } = {}) {
  return new Request("https://royalegyptgroup-vy7.pages.dev/api/listings", {
    method,
    headers: {
      origin: requestOrigin,
      "cf-connecting-ip": ip
    },
    ...(form ? { body: form } : {})
  });
}

test("GET returns only approved listings and never exposes stored image payloads", async () => {
  const db = new FakeDB();
  db.rows = [
    { id: "approved-1", title: "Approved", status: "approved", images: '["private-image-reference"]' },
    { id: "pending-1", title: "Pending", status: "pending", images: "[]" }
  ];
  const response = await onRequest({ request: request({ method: "GET" }), env: { DB: db } });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.listings.length, 1);
  assert.equal(result.listings[0].id, "approved-1");
  assert.deepEqual(result.listings[0].images, []);
});

test("rejects public listing submission from an untrusted Origin", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: request({ form: makeForm(), requestOrigin: "https://attacker.example" }),
    env: { DB: db }
  });
  assert.equal(response.status, 403);
  assert.equal(db.rows.length, 0);
});

test("rejects submission when D1 is unavailable", async () => {
  const response = await onRequest({ request: request({ form: makeForm() }), env: {} });
  assert.equal(response.status, 503);
});

test("stores valid listing submissions as pending and returns a reference", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: request({ form: makeForm() }),
    env: { DB: db }
  });
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.ok(result.id);
  assert.equal(result.status, "pending");
  assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0].status, "pending");
  assert.equal(db.rows[0].contact_phone, "+20 100 000 0000");
  assert.equal(db.rows[0].area_sqm, 250);
  assert.equal(db.rows[0].images, "[]");
});

test("rejects missing consent without writing a listing", async () => {
  const db = new FakeDB();
  const form = makeForm();
  form.delete("consent");
  const response = await onRequest({ request: request({ form }), env: { DB: db } });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "consent_required");
  assert.equal(db.rows.length, 0);
});

test("rejects a filled honeypot without writing a listing", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: request({ form: makeForm({ website: "bot" }) }),
    env: { DB: db }
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "submission_rejected");
  assert.equal(db.rows.length, 0);
});

test("rejects invalid phone numbers", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: request({ form: makeForm({ contact_phone: "abc1234567" }) }),
    env: { DB: db }
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "invalid_phone");
  assert.equal(db.rows.length, 0);
});

test("rejects invalid property types and purposes", async () => {
  for (const [field, value, expected] of [
    ["property_type", "Unknown type", "invalid_property_type"],
    ["purpose", "Unknown purpose", "invalid_purpose"]
  ]) {
    const db = new FakeDB();
    const response = await onRequest({
      request: request({ form: makeForm({ [field]: value }) }),
      env: { DB: db }
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, expected);
    assert.equal(db.rows.length, 0);
  }
});

test("rejects non-finite, zero, negative and excessive area values", async () => {
  for (const area of ["NaN", "0", "-1", "10000001"]) {
    const db = new FakeDB();
    const response = await onRequest({
      request: request({ form: makeForm({ area_sqm: area }) }),
      env: { DB: db }
    });
    assert.equal(response.status, 400, area);
    assert.equal((await response.json()).code, "invalid_area", area);
    assert.equal(db.rows.length, 0);
  }
});

test("rejects image uploads explicitly while keeping the listing uncreated", async () => {
  const db = new FakeDB();
  const form = makeForm();
  form.append("images", new Blob(["synthetic image bytes"], { type: "image/png" }), "synthetic.png");
  const response = await onRequest({ request: request({ form }), env: { DB: db } });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "image_upload_unavailable");
  assert.equal(db.rows.length, 0);
});

test("rejects requests over the bounded multipart body size", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: request({ form: makeForm({ description: "x".repeat(11_000) }) }),
    env: { DB: db }
  });
  assert.equal(response.status, 413);
  assert.equal((await response.json()).code, "payload_too_large");
  assert.equal(db.rows.length, 0);
});

test("accepts the unique Cloudflare Pages Preview hostname", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: request({
      form: makeForm(),
      requestOrigin: "https://pr-preview-123.royalegyptgroup-vy7.pages.dev"
    }),
    env: { DB: db }
  });
  assert.equal(response.status, 201);
  assert.equal(db.rows.length, 1);
});

test("rate limits each client to ten listing submissions per minute", async () => {
  const db = new FakeDB();
  const responses = [];
  for (let i = 0; i < 11; i += 1) {
    responses.push(await onRequest({
      request: request({
        form: makeForm({ title: "Synthetic listing " + i }),
        ip: "203.0.113.25"
      }),
      env: { DB: db }
    }));
  }
  assert.deepEqual(responses.map(response => response.status), [
    201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 429
  ]);
  assert.equal(db.rows.length, 10);
});
