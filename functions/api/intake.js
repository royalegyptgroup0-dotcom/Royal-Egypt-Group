const MAX_BODY_BYTES = 10 * 1024;
const ALLOWED_TYPES = new Set(["customer", "opportunity", "listing"]);
const ALLOWED_LANGUAGES = new Set(["ar", "en", "ru"]);
const TRUSTED_WEBHOOK_HOST = "hook.eu1.make.com";
const requestBuckets = new Map();
const SECURITY_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

// Best-effort per-isolate protection only; configure Cloudflare edge rate limiting too.
function allowRequest(ip) {
  const now = Date.now();
  const bucket = requestBuckets.get(ip);
  if (!bucket || now - bucket.startedAt >= 60_000) {
    requestBuckets.set(ip, { startedAt: now, count: 1 });
    if (requestBuckets.size > 500) {
      for (const [key, value] of requestBuckets) {
        if (now - value.startedAt >= 60_000) requestBuckets.delete(key);
      }
    }
    return true;
  }
  if (bucket.count >= 10) return false;
  bucket.count += 1;
  return true;
}

function json(data, status, origin) {
  const headers = new Headers(SECURITY_HEADERS);
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function allowedOrigin(origin) {
  if (!origin) return false;
  return origin === "https://royalegyptgroup.pages.dev" ||
    /^https:\/\/[a-z0-9-]+\.royalegyptgroup\.pages\.dev$/i.test(origin);
}

function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function trustedWebhook(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === TRUSTED_WEBHOOK_HOST &&
      !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}

export async function onRequest({ request, env }) {
  const origin = request.headers.get("Origin") || "";
  if (!allowedOrigin(origin)) return json({ error: "origin_not_allowed" }, 403);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "Content-Type",
      "access-control-max-age": "600",
      "vary": "Origin",
    }});
  }

  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!allowRequest(clientIp)) return json({ error: "rate_limited" }, 429);

  if (!env.MAKE_INTAKE_WEBHOOK_URL) return json({ error: "intake_not_configured" }, 503);
  if (!trustedWebhook(env.MAKE_INTAKE_WEBHOOK_URL)) {
    return json({ error: "intake_configuration_invalid" }, 503);
  }
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    return json({ error: "json_required" }, 415);
  }

  let raw;
  try {
    raw = await request.text();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return json({ error: "payload_too_large" }, 413);
  }

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return json({ error: "invalid_payload" }, 400);
  }

  // Hidden honeypot field: never forward submissions that fill it.
  if (clean(input.website, 200)) return json({ error: "submission_rejected" }, 400);

  const name = clean(input.name, 100);
  const phone = clean(input.phone, 24);
  const email = clean(input.email, 160);
  const requestType = clean(input.request_type, 30);
  const location = clean(input.location, 180);
  const details = clean(input.details, 3000);
  const language = clean(input.language, 2);
  const digits = phone.replace(/\D/g, "");

  if (name.length < 2 || digits.length < 7 || digits.length > 15 ||
      !details || !ALLOWED_TYPES.has(requestType) ||
      !ALLOWED_LANGUAGES.has(language) || input.consent !== true) {
    return json({ error: "validation_failed" }, 400, origin);
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json({ error: "invalid_email" }, 400, origin);
  }

  const reference = crypto.randomUUID();
  const forwarded = {
    event: "royal_egypt_website_intake",
    reference,
    request_type: requestType,
    status: requestType === "listing" ? "pending_review" : "new",
    name,
    phone,
    email: email || null,
    location: location || null,
    details,
    language,
    consent: true,
    source: "royalegyptgroup.pages.dev",
    received_at: new Date().toISOString(),
  };

  try {
    const upstream = await fetch(env.MAKE_INTAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(forwarded),
    });
    if (!upstream.ok) return json({ error: "upstream_unavailable" }, 502, origin);
    return json({ accepted: true, reference }, 202, origin);
  } catch {
    return json({ error: "upstream_unavailable" }, 502, origin);
  }
}
