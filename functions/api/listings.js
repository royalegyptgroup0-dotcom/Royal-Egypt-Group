export async function onRequest({ request, env }) {
  const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
  if (!env.DB || !env.PROPERTY_IMAGES) return json({ error: "خدمة الإعلانات لم تُفعّل بعد. يلزم ربط D1 وR2 في إعدادات Cloudflare." }, 503);
  if (request.method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT id,title,property_type,location,area_sqm,price,purpose,description,images,created_at FROM listings WHERE status='approved' ORDER BY created_at DESC LIMIT 100"
    ).all();
    return json({ listings: (results || []).map(row => ({ ...row, images: JSON.parse(row.images || "[]").map(key => { const parts = key.split("/"); return "/api/listing-image/" + parts[1] + "/" + parts[2]; }) })) });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const data = await request.formData();
  const required = ["contact_name","contact_phone","title","property_type","location","description"];
  for (const key of required) if (!String(data.get(key) || "").trim()) return json({ error: "يرجى استكمال الحقول المطلوبة." }, 400);
  if (data.get("consent") !== "on") return json({ error: "الموافقة مطلوبة لإرسال الإعلان." }, 400);
  const images = data.getAll("images").filter(x => x && typeof x.arrayBuffer === "function" && x.size);
  if (images.length > 5) return json({ error: "الحد الأقصى 5 صور." }, 400);
  const allowed = new Set(["image/jpeg","image/png","image/webp"]);
  for (const file of images) if (!allowed.has(file.type) || file.size > 5*1024*1024) return json({ error: "الصور المسموحة JPG أو PNG أو WEBP وبحد أقصى 5MB للصورة." }, 400);
  const id = crypto.randomUUID();
  const uploaded = [];
  try {
    for (let i=0;i<images.length;i++) {
      const file = images[i];
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const key = `pending/${id}/${i+1}.${ext}`;
      await env.PROPERTY_IMAGES.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
      uploaded.push(key);
    }
    await env.DB.prepare(`INSERT INTO listings
      (id,contact_name,contact_phone,title,property_type,location,area_sqm,price,purpose,description,images,status,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending',datetime('now'))`)
      .bind(id,String(data.get("contact_name")).trim(),String(data.get("contact_phone")).trim(),
        String(data.get("title")).trim(),String(data.get("property_type")).trim(),String(data.get("location")).trim(),
        Number(data.get("area_sqm")) || null,String(data.get("price")||"").trim(),
        String(data.get("purpose")||"بيع").trim(),String(data.get("description")).trim(),
        JSON.stringify(uploaded)).run();
    return json({ id, status: "pending" }, 201);
  } catch (error) {
    for (const key of uploaded) await env.PROPERTY_IMAGES.delete(key).catch(()=>{});
    return json({ error: "تعذر حفظ الإعلان حاليًا. حاول مرة أخرى لاحقًا." }, 500);
  }
}