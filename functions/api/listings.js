const MAX_BODY_BYTES = 10 * 1024;
const MAX_REQUESTS_PER_IP_PER_MINUTE = 10;
const ALLOWED_ORIGINS = new Set([
  "https://royalegyptgroup-vy7.pages.dev",
  "https://royalegyptgroup.com",
  "https://www.royalegyptgroup.com",
]);
const ALLOWED_PROPERTY_TYPES = new Set(["شقة", "فيلا", "أرض", "تجاري", "إداري", "سياحي", "أخرى"]);
const ALLOWED_PURPOSES = new Set(["بيع", "إيجار", "استثمار"]);
const SECURITY_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

function allowedOrigin(origin) {
  return ALLOWED_ORIGINS.has(origin) ||
    /^https:\/\/[a-z0-9-]+\.royalegyptgroup-vy7\.pages\.dev$/i.test(origin || "");
}

function json(data, status = 200, origin = "") {
  const headers = new Headers(SECURITY_HEADERS);
  if (origin && allowedOrigin(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
  }
  return new Response(JSON.stringify(data), { status, headers });
}

async function allowRequest(db, ip) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  const ipHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  const windowStart = Math.floor(Date.now() / 60_000);
  const row = await db.prepare(`
    INSERT INTO intake_rate_limits (ip_hash, window_start, request_count, updated_at)
    VALUES (?, ?, 1, datetime('now'))
    ON CONFLICT(ip_hash) DO UPDATE SET
      request_count = CASE
        WHEN intake_rate_limits.window_start = excluded.window_start
          THEN intake_rate_limits.request_count + 1
        ELSE 1
      END,
      window_start = excluded.window_start,
      updated_at = datetime('now')
    RETURNING request_count
  `).bind(ipHash, windowStart).first();
  return Number(row?.request_count || 0) <= MAX_REQUESTS_PER_IP_PER_MINUTE;
}

const ERROR_MESSAGES = {
  database_unavailable: "قاعدة بيانات الإعلانات غير متاحة حاليًا.",
  method_not_allowed: "طريقة الطلب غير مسموح بها.",
  origin_not_allowed: "مصدر الطلب غير مسموح.",
  multipart_form_required: "صيغة إرسال الإعلان غير صحيحة.",
  payload_too_large: "حجم البيانات أكبر من الحد المسموح.",
  invalid_body: "تعذر قراءة بيانات الإعلان.",
  listing_protection_unavailable: "تعذر تفعيل حماية استقبال الإعلانات. حاول لاحقًا.",
  rate_limited: "وصلت إلى الحد المؤقت لإرسال الإعلانات. حاول بعد دقيقة.",
  invalid_form_data: "صيغة البيانات غير صحيحة. أعد إرسال النموذج.",
  submission_rejected: "تم رفض الطلب الآلي.",
  required_fields_missing: "يرجى استكمال الحقول المطلوبة.",
  field_too_long: "أحد الحقول أطول من الحد المسموح.",
  invalid_phone: "يرجى إدخال رقم هاتف صحيح.",
  invalid_property_type: "نوع العقار المحدد غير صحيح.",
  consent_required: "الموافقة مطلوبة لإرسال الإعلان.",
  invalid_area: "المساحة يجب أن تكون رقمًا موجبًا وصحيحًا.",
  invalid_purpose: "الغرض المحدد غير صحيح.",
  image_upload_unavailable: "استقبال الصور غير متاح حاليًا. أرسل الصور بعد تسجيل الإعلان عبر واتساب Royal Egypt.",
  listing_storage_failed: "تعذر حفظ الإعلان حاليًا. حاول مرة أخرى لاحقًا.",
};

function fail(code, status, origin = "") {
  return json({ error: ERROR_MESSAGES[code] || "تعذر تنفيذ الطلب حاليًا.", code }, status, origin);
}

export async function onRequest({ request, env }) {
  const origin = request.headers.get("Origin") || "";

  if (request.method === "OPTIONS") {
    if (!allowedOrigin(origin)) return fail("origin_not_allowed", 403);
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "Content-Type",
        "access-control-max-age": "600",
        "vary": "Origin",
      },
    });
  }

  if (!env.DB) return fail("database_unavailable", 503, origin);

  if (request.method === "GET") {
    try {
      const { results } = await env.DB.prepare(
        "SELECT id,title,property_type,location,area_sqm,price,purpose,description,images,created_at FROM listings WHERE status='approved' ORDER BY created_at DESC LIMIT 100"
      ).all();
      return json({ listings: (results || []).map(row => ({ ...row, images: [] })) });
    } catch {
      return json({ error: "تعذر تحميل الإعلانات حاليًا." }, 500);
    }
  }

  if (request.method !== "POST") return fail("method_not_allowed", 405, origin);
  if (!allowedOrigin(origin)) return fail("origin_not_allowed", 403);

  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("multipart/form-data")) {
    return fail("multipart_form_required", 415, origin);
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) return fail("payload_too_large", 413, origin);

  const reader = request.body?.getReader();
  if (!reader) return fail("invalid_body", 400, origin);
  const bodyChunks = [];
  let bodySize = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bodySize += value.byteLength;
      if (bodySize > MAX_BODY_BYTES) {
        reader.cancel().catch(() => {});
        return fail("payload_too_large", 413, origin);
      }
      bodyChunks.push(value);
    }
  } catch {
    return fail("invalid_body", 400, origin);
  }

  // Rebuild only the already-bounded body so formData() never buffers an unbounded upload.
  const boundedBody = new Uint8Array(bodySize);
  let bodyOffset = 0;
  for (const chunk of bodyChunks) {
    boundedBody.set(chunk, bodyOffset);
    bodyOffset += chunk.byteLength;
  }

  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  try {
    if (!await allowRequest(env.DB, clientIp)) return fail("rate_limited", 429, origin);
  } catch {
    return fail("listing_protection_unavailable", 503, origin);
  }

  let data;
  try {
    const boundedHeaders = new Headers(request.headers);
    boundedHeaders.delete("content-length");
    const boundedRequest = new Request(request.url, {
      method: "POST",
      headers: boundedHeaders,
      body: boundedBody,
    });
    data = await boundedRequest.formData();
  } catch {
    return fail("invalid_form_data", 400, origin);
  }

  const value = key => String(data.get(key) ?? "").trim();
  if (value("website")) return fail("submission_rejected", 400, origin);

  const required = ["contact_name", "contact_phone", "title", "property_type", "location", "description"];
  for (const key of required) {
    if (!value(key)) return fail("required_fields_missing", 400, origin);
  }

  const limits = {
    contact_name: 100,
    contact_phone: 30,
    title: 140,
    property_type: 80,
    location: 180,
    price: 80,
    purpose: 30,
    description: 3000,
  };
  for (const [key, max] of Object.entries(limits)) {
    if (value(key).length > max) return fail("field_too_long", 400, origin);
  }

  const phone = value("contact_phone");
  const digits = phone.replace(/\D/g, "");
  if (!/^[+0-9()\s.-]{7,30}$/.test(phone) || digits.length < 7 || digits.length > 15) {
    return fail("invalid_phone", 400, origin);
  }

  if (!ALLOWED_PROPERTY_TYPES.has(value("property_type"))) {
    return fail("invalid_property_type", 400, origin);
  }
  if (data.get("consent") !== "on") return fail("consent_required", 400, origin);

  const areaRaw = value("area_sqm");
  let area = null;
  if (areaRaw) {
    area = Number(areaRaw);
    if (!Number.isFinite(area) || area <= 0 || area > 10_000_000) {
      return fail("invalid_area", 400, origin);
    }
  }

  const purpose = value("purpose") || "بيع";
  if (!ALLOWED_PURPOSES.has(purpose)) return fail("invalid_purpose", 400, origin);

  const images = data.getAll("images").filter(file =>
    file && typeof file.arrayBuffer === "function" && file.size > 0
  );
  if (images.length) {
    return fail("image_upload_unavailable", 400, origin);
  }

  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      "INSERT INTO listings (id,contact_name,contact_phone,title,property_type,location,area_sqm,price,purpose,description,images,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending',datetime('now'))"
    ).bind(
      id,
      value("contact_name"),
      phone,
      value("title"),
      value("property_type"),
      value("location"),
      area,
      value("price"),
      purpose,
      value("description"),
      "[]"
    ).run();

    return json({ id, status: "pending" }, 201, origin);
  } catch {
    return fail("listing_storage_failed", 503, origin);
  }
}
