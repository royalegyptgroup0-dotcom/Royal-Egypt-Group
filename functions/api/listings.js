export async function onRequest({ request, env }) {
  const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
  if (!env.DB) return json({ error: "قاعدة بيانات الإعلانات غير مربوطة بعد." }, 503);
  if (request.method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT id,title,property_type,location,area_sqm,price,purpose,description,images,created_at FROM listings WHERE status='approved' ORDER BY created_at DESC LIMIT 100"
    ).all();
    return json({ listings: (results || []).map(row => ({ ...row, images: [] })) });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const data = await request.formData();
  const required = ["contact_name","contact_phone","title","property_type","location","description"];
  for (const key of required) if (!String(data.get(key) || "").trim()) return json({ error: "يرجى استكمال الحقول المطلوبة." }, 400);
  if (data.get("consent") !== "on") return json({ error: "الموافقة مطلوبة لإرسال الإعلان." }, 400);
  const images = data.getAll("images").filter(x => x && typeof x.arrayBuffer === "function" && x.size);
  if (images.length) return json({ error: "استقبال الصور غير متاح حاليًا بدون خدمة تخزين مدفوعة. أرسل الصور بعد تسجيل الإعلان عبر واتساب Royal Egypt." }, 400);
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(`INSERT INTO listings
      (id,contact_name,contact_phone,title,property_type,location,area_sqm,price,purpose,description,images,status,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending',datetime('now'))`)
      .bind(id,String(data.get("contact_name")).trim(),String(data.get("contact_phone")).trim(),
        String(data.get("title")).trim(),String(data.get("property_type")).trim(),String(data.get("location")).trim(),
        Number(data.get("area_sqm")) || null,String(data.get("price")||"").trim(),
        String(data.get("purpose")||"بيع").trim(),String(data.get("description")).trim(),"[]").run();
    return json({ id, status: "pending" }, 201);
  } catch (error) {
    return json({ error: "تعذر حفظ الإعلان حاليًا. حاول مرة أخرى لاحقًا." }, 500);
  }
}