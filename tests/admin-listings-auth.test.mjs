import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/admin/listings.js";

const token = "synthetic-admin-token";

class FakeDB {
  constructor() {
    this.calls = [];
  }
  prepare(sql) {
    this.calls.push({ sql });
    return {
      all: async () => ({
        results: [{
          id: "listing-1",
          title: "Synthetic listing",
          status: "pending",
          images: "[\"private-image-payload\"]"
        }]
      }),
      bind: (...values) => ({
        run: async () => {
          this.calls.push({ values });
          return { meta: { changes: values[1] === "missing" ? 0 : 1 } };
        }
      })
    };
  }
}

function request(method, body, authorization = `Bearer ${token}`) {
  return new Request("https://example.test/api/admin/listings", {
    method,
    headers: {
      ...(authorization ? { authorization } : {}),
      ...(body ? { "content-type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

test("rejects a missing admin token before touching D1", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: request("GET", null, ""),
    env: { DB: db, ADMIN_TOKEN: token }
  });
  assert.equal(response.status, 401);
  assert.equal(db.calls.length, 0);
});

test("rejects an incorrect admin token before touching D1", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: request("GET", null, "Bearer wrong-token"),
    env: { DB: db, ADMIN_TOKEN: token }
  });
  assert.equal(response.status, 401);
  assert.equal(db.calls.length, 0);
});

test("rejects requests when the server token is not configured", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: request("GET"),
    env: { DB: db }
  });
  assert.equal(response.status, 401);
  assert.equal(db.calls.length, 0);
});

test("allows a valid token and does not expose stored image payloads", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: request("GET"),
    env: { DB: db, ADMIN_TOKEN: token }
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.listings.length, 1);
  assert.deepEqual(body.listings[0].images, []);
  assert.equal(JSON.stringify(body).includes("private-image-payload"), false);
  assert.match(db.calls[0].sql, /status='pending'/);
});

test("allows an authenticated owner to approve a pending listing", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: request("PATCH", { id: "listing-1", status: "approved" }),
    env: { DB: db, ADMIN_TOKEN: token }
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.deepEqual(db.calls[1].values, ["approved", "listing-1"]);
});

test("rejects invalid listing status changes", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: request("PATCH", { id: "listing-1", status: "delete" }),
    env: { DB: db, ADMIN_TOKEN: token }
  });
  assert.equal(response.status, 400);
  assert.equal(db.calls.length, 0);
});

test("returns not found when the pending listing update changes no rows", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: request("PATCH", { id: "missing", status: "rejected" }),
    env: { DB: db, ADMIN_TOKEN: token }
  });
  assert.equal(response.status, 404);
});

test("does not allow unauthenticated requests to change listing status", async () => {
  const db = new FakeDB();
  const response = await onRequest({
    request: request("PATCH", { id: "listing-1", status: "approved" }, ""),
    env: { DB: db, ADMIN_TOKEN: token }
  });
  assert.equal(response.status, 401);
  assert.equal(db.calls.length, 0);
});
