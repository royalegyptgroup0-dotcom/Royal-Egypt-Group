import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/admin/listings.js";

const token = "synthetic-admin-token";
class FakeDB {
  constructor() { this.calls = []; }
  prepare(sql) {
    this.calls.push(sql);
    return {
      all: async () => ({ results: [{ id: "l1", status: "pending", images: "[]" }] }),
      bind: (...values) => ({ run: async () => ({ meta: { changes: values[1] === "missing" ? 0 : 1 } }) })
    };
  }
}
function request(method, body, auth = `Bearer ${token}`) {
  return new Request("https://example.test/api/admin/listings", {
    method,
    headers: { ...(auth ? { authorization: auth } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
}
test("rejects unauthenticated moderation requests", async () => {
  const response = await onRequest({ request: request("GET", null, ""), env: { DB: new FakeDB(), ADMIN_TOKEN: token } });
  assert.equal(response.status, 401);
});
test("returns only pending listings to the owner", async () => {
  const db = new FakeDB();
  const response = await onRequest({ request: request("GET"), env: { DB: db, ADMIN_TOKEN: token } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).listings[0].status, "pending");
  assert.match(db.calls[0], /status='pending'/);
});
test("only approves or rejects a pending listing", async () => {
  const response = await onRequest({ request: request("PATCH", { id: "l1", status: "approved" }), env: { DB: new FakeDB(), ADMIN_TOKEN: token } });
  assert.equal(response.status, 200);
});
test("rejects unsupported moderation status", async () => {
  const response = await onRequest({ request: request("PATCH", { id: "l1", status: "published" }), env: { DB: new FakeDB(), ADMIN_TOKEN: token } });
  assert.equal(response.status, 400);
});
