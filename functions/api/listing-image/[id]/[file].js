export async function onRequest({ request, env, params }) {
  if (!env.DB || !env.PROPERTY_IMAGES) return new Response("Not configured",{status:503});
  const id=String(params.id||"");
  const file=String(params.file||"");
  if(!/^[0-9a-f-]{36}$/i.test(id) || !/^[1-5]\.(jpg|png|webp)$/.test(file)) return new Response("Not found",{status:404});
  const row=await env.DB.prepare("SELECT images FROM listings WHERE id=? AND status='approved'").bind(id).first();
  if(!row) return new Response("Not found",{status:404});
  const key=`public/${id}/${file}`;
  if(!JSON.parse(row.images||"[]").includes(key)) return new Response("Not found",{status:404});
  const object=await env.PROPERTY_IMAGES.get(key);
  if(!object) return new Response("Not found",{status:404});
  const headers=new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag",object.httpEtag);
  headers.set("cache-control","public, max-age=3600");
  headers.set("x-content-type-options","nosniff");
  return new Response(object.body,{headers});
}