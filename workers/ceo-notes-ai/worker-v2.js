const API_GEN_PATH="/api/generate";
const API_IMAGE_PATH="/api/image";
const API_PUBLISH_PATH="/api/publish";
const OUTBOX_PREFIX="/api/outbox/";
const FEED_URL="https://raw.githubusercontent.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/ceo-notes-site/notes/posts.json";
const PUBLIC_BASE="https://ceo-notes-ai.yasser-abdelaziz83.workers.dev";
function publicBase(env){return String(env.PUBLIC_BASE||PUBLIC_BASE).replace(/\/+$/,"");}

function authorized(req,env){
  const token=env.ADMIN_TOKEN;
  return typeof token==="string"&&token.length>=32&&req.headers.get("Authorization")==="Bearer "+token;
}
const J=(value,status=200,cors=false)=>new Response(JSON.stringify(value),{
  status,
  headers:{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"no-store",
    ...(cors?{"Access-Control-Allow-Origin":"https://ceo-notes.pages.dev","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"}:{})
  }
});
function cairoDate(value=new Date()){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(value);
  const part=name=>parts.find(item=>item.type===name)?.value||"";
  return part("year")+"-"+part("month")+"-"+part("day");
}
function parseAI(value){
  if(typeof value!=="string")throw new Error("missing AI text");
  const start=value.indexOf("{"),end=value.lastIndexOf("}");
  if(start<0||end<=start)throw new Error("invalid AI JSON");
  return JSON.parse(value.slice(start,end+1));
}
function editorialFields(post){
  return {
    day:Number(post.day),
    title:String(post.title||"").trim(),
    article:String(post.article||"").trim(),
    ideaOfTheDay:String(post.ideaOfTheDay||"").trim(),
    ceoChallenge:String(post.ceoChallenge||"").trim(),
    discussionQuestion:String(post.discussionQuestion||"").trim(),
    hashtags:Array.isArray(post.hashtags)?post.hashtags.join(" "):String(post.hashtags||"").trim()
  };
}
async function contentHash(post){
  const fields=editorialFields(post);
  const bytes=new TextEncoder().encode(JSON.stringify(fields));
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}
async function backupHash(value){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}
async function getFeed(env){
  const saved=await env.CEO_NOTES_KV.get("feed");
  if(saved){
    try{
      const parsed=JSON.parse(saved);
      if(Array.isArray(parsed.posts))return parsed;
    }catch(error){}
  }
  let seed={version:1,posts:[]};
  try{
    const response=await fetch(FEED_URL,{cf:{cacheTtl:0}});
    if(response.ok){
      const parsed=await response.json();
      if(Array.isArray(parsed.posts))seed=parsed;
    }
  }catch(error){}
  await env.CEO_NOTES_KV.put("feed",JSON.stringify(seed));
  return seed;
}
async function createBackup(env,scheduledTime){
  const now=new Date(scheduledTime||Date.now());
  const date=now.toISOString().slice(0,10);
  const feed=await getFeed(env);
  const feedValue=JSON.stringify(feed);
  const feedSha256=await backupHash(feedValue);
  await env.CEO_NOTES_KV.put("backup:"+date+":feed",feedValue);
  const imageKeys=[],imageMetaKeys=[],draftKeys=[],outboxKeys=[];
  for(const prefix of ["image:","image-meta:","draft:","outbox:"]){
    const page=await env.CEO_NOTES_KV.list({prefix,limit:1000});
    for(const item of page.keys||[]){
      const value=await env.CEO_NOTES_KV.get(item.name);
      if(value===null)continue;
      const stored=String(value);
      await env.CEO_NOTES_KV.put("backup:"+date+":"+item.name,stored);
      const entry={name:item.name,length:stored.length,sha256:await backupHash(stored)};
      if(prefix==="image:")imageKeys.push(entry);
      else if(prefix==="image-meta:")imageMetaKeys.push(entry);
      else if(prefix==="draft:")draftKeys.push(entry);
      else outboxKeys.push(entry);
    }
  }
  let coordinatorOutboxCount=0,coordinatorOutboxSha256=null;
  if(env.OUTBOX_COORDINATOR){
    const coordinatorRecords=[];
    for(const post of feed.posts||[]){
      const day=Number(post.day);
      if(!Number.isInteger(day)||day<1)continue;
      const coordinator=env.OUTBOX_COORDINATOR.get(env.OUTBOX_COORDINATOR.idFromName("ceo-notes-day:"+day));
      const snapshotResponse=await coordinator.fetch("https://outbox-coordinator/snapshot");
      if(!snapshotResponse.ok)throw new Error("outbox_coordinator_backup_failed");
      const snapshot=await snapshotResponse.json();
      coordinatorRecords.push(...(snapshot.records||[]));
    }
    const snapshotValue=JSON.stringify(coordinatorRecords);
    coordinatorOutboxCount=coordinatorRecords.length;
    coordinatorOutboxSha256=await backupHash(snapshotValue);
    await env.CEO_NOTES_KV.put("backup:"+date+":outbox-coordinator",snapshotValue);
  }
  const manifest={
    version:3,
    date,
    createdAt:now.toISOString(),
    feedSha256,
    postDays:(feed.posts||[]).map(post=>Number(post.day)),
    imageKeys,
    imageMetaKeys,
    draftKeys,
    outboxKeys,
    coordinatorOutboxCount,
    coordinatorOutboxSha256
  };
  await env.CEO_NOTES_KV.put("backup:"+date+":manifest",JSON.stringify(manifest));
  const all=await env.CEO_NOTES_KV.list({prefix:"backup:",limit:1000});
  const dates=[...new Set((all.keys||[]).map(item=>item.name.split(":")[1]).filter(Boolean))].sort();
  const stale=dates.slice(0,Math.max(0,dates.length-30));
  for(const oldDate of stale){
    const old=await env.CEO_NOTES_KV.list({prefix:"backup:"+oldDate+":",limit:1000});
    for(const item of old.keys||[])await env.CEO_NOTES_KV.delete(item.name);
  }
  return {date,postCount:(feed.posts||[]).length,imageCount:imageKeys.length,draftCount:draftKeys.length,outboxCount:outboxKeys.length,feedSha256,retainedDays:Math.min(dates.length,30)};
}
function outboxAllowed(platform,identity){
  const allowed={
    facebook:["ceo-page"],
    instagram:["ceo-notes"]
  };
  return Array.isArray(allowed[platform])&&allowed[platform].includes(identity);
}
function outboxKey(platform,identity,day){
  return "outbox:"+platform+":"+identity+":"+day;
}
async function validateOutboxContext(env,body){
  const day=Number(body.day);
  const platform=String(body.platform||"");
  const identity=String(body.identity||"");
  const hash=String(body.contentHash||"");
  if(!Number.isInteger(day)||day<1||!hash||!outboxAllowed(platform,identity)){
    return {error:J({error:"invalid_outbox_identity_or_payload"},400)};
  }
  const feed=await getFeed(env);
  const post=(feed.posts||[]).find(item=>Number(item.day)===day&&item.status==="Published");
  if(!post)return {error:J({error:"published_post_not_found"},404)};
  const savedHash=String(post.contentHash||await contentHash(post));
  if(savedHash!==hash)return {error:J({error:"content_hash_mismatch"},409)};
  return {day,platform,identity,hash,key:outboxKey(platform,identity,day)};
}
async function withEditorialLock(env,date,work){
  if(!env.OUTBOX_COORDINATOR)return J({error:"outbox_coordinator_unavailable"},503);
  const token=crypto.randomUUID();
  const stub=env.OUTBOX_COORDINATOR.get(env.OUTBOX_COORDINATOR.idFromName("ceo-notes-date:"+String(date)));
  const key="editorial:"+String(date);
  const locked=await stub.fetch("https://outbox-coordinator/lock",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({key,token,ttlMs:900000})
  });
  if(!locked.ok)return new Response(locked.body,{status:locked.status,headers:locked.headers});
  try{
    return await work();
  }finally{
    await stub.fetch("https://outbox-coordinator/unlock",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({key,token})
    });
  }
}

async function handleOutbox(req,env,path){
  if(!env.OUTBOX_COORDINATOR)return J({error:"outbox_coordinator_unavailable"},503);
  const body=await req.json();
  const context=await validateOutboxContext(env,body);
  if(context.error)return context.error;
  const action=path.slice(OUTBOX_PREFIX.length);
  const id=env.OUTBOX_COORDINATOR.idFromName("ceo-notes-day:"+context.day);
  const stub=env.OUTBOX_COORDINATOR.get(id);
  const response=await stub.fetch("https://outbox-coordinator/"+action,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({...body,day:context.day,platform:context.platform,identity:context.identity,contentHash:context.hash})
  });
  return new Response(response.body,{status:response.status,headers:response.headers});
}
async function generatePost(env){
  const date=cairoDate();
  const draftKey="draft:"+date;
  const saved=await env.CEO_NOTES_KV.get(draftKey);
  if(saved){
    try{
      const draft=JSON.parse(saved);
      if(draft?.post&&draft?.contentHash)return J({ok:true,post:draft.post,imagePrompt:draft.imagePrompt,date,contentHash:draft.contentHash,reused:true});
    }catch(error){}
    return J({error:"draft_record_corrupt"},409);
  }
  const feed=await getFeed(env);
  const posts=Array.isArray(feed.posts)?feed.posts:[];
  const day=Math.max(0,...posts.map(post=>Number(post.day)||0))+1;
  const recent=posts.slice(-12).map(post=>({day:post.day,title:post.title,idea:post.ideaOfTheDay}));
  const prompt="اكتب منشور CEO NOTES رقم "+day+" باللهجة المصرية المهنية، بنفس روح السلسلة: عنوان قوي، افتتاحية ذكية، فقرات تحليلية متصلة، رسالة إدارية عملية، ثم فكرة اليوم والتحدي وسؤال النقاش.\n"+
    "الموضوع جديد وغير مكرر عن هذه العناوين والأفكار الأخيرة: "+JSON.stringify(recent)+".\n"+
    "نوّع بين القيادة، التفويض، الثقة، التواصل، التركيز، إدارة الخلاف، التعلم، واتخاذ القرار. المقال 160-200 كلمة في 4 فقرات فعلية، باللهجة المصرية الطبيعية المحترمة، لا تبدأ بعبارة \"زملائي الأعزاء\"، ولا تستخدم فصحى جامدة أو شعارات عامة. لا تخترع أسماء أشخاص أو وقائع محددة؛ استخدم مواقف عمل عامة واقعية.\n"+
    "أعد JSON فقط بالمفاتيح day,title,article,ideaOfTheDay,ceoChallenge,discussionQuestion,hashtags,imagePrompt.\n"+
    "فكرة اليوم جملة قصيرة قوية. التحدي تمرين محدد خلال 48 ساعة. سؤال النقاش مفتوح وغير سطحي. الهاشتاجات نص واحد مفصول بمسافات ويشمل #CEO_Notes #CEO_Challenge #فكرة_اليوم #إدارة #قيادة ووسمين مناسبين.\n"+
    "imagePrompt باللغة الإنجليزية، صورة تحريرية فوتوغرافية سينمائية portrait مرتبطة مباشرة بموضوع المقال، مشهد CEO واقعي، ألوان أسود وذهبي، إضاءة راقية، بلا كتابة أو شعارات أو علامات مائية.";
  const ai=await env.AI.run("@cf/aisingapore/gemma-sea-lion-v4-27b-it",{
    messages:[
      {role:"system",content:"You are the chief editor of CEO Notes. Write authentic Egyptian Arabic. Return only valid JSON."},
      {role:"user",content:prompt}
    ],
    max_tokens:1200,
    temperature:0.72
  });
  const generated=parseAI(ai.response||ai.choices?.[0]?.message?.content);
  const post=editorialFields({...generated,day});
  const imagePrompt=String(generated.imagePrompt||"").trim();
  const normalize=value=>String(value||"").toLocaleLowerCase("ar").replace(/\s+/g," ").trim();
  const duplicate=posts.some(item=>normalize(item.title)===normalize(post.title)||normalize(item.article)===normalize(post.article));
  if(duplicate)return J({error:"duplicate_editorial_rejected",day},409);
  if(!post.title||post.title.length<8||!post.article||post.article.length<500||!post.ideaOfTheDay||!post.ceoChallenge||!post.discussionQuestion||!post.hashtags||!imagePrompt){
    return J({error:"quality_check_failed",day,articleLength:post.article.length},502);
  }
  const hash=await contentHash(post);
  const draft={version:1,date,post,imagePrompt,contentHash:hash,status:"draft",createdAt:new Date().toISOString()};
  await env.CEO_NOTES_KV.put(draftKey,JSON.stringify(draft));
  return J({ok:true,post,imagePrompt,date,contentHash:hash,reused:false,usage:{textNeurons:ai.usage?.neurons}});
}
async function generateImage(req,env){
  const body=await req.json();
  const date=String(body.date||cairoDate());
  const draftRaw=await env.CEO_NOTES_KV.get("draft:"+date);
  if(!draftRaw)return J({error:"draft_not_found"},404);
  const draft=JSON.parse(draftRaw);
  const post=body.post||draft.post;
  const hash=await contentHash(post);
  if(Number(post.day)!==Number(draft.post.day)||hash!==draft.contentHash)return J({error:"draft_content_mismatch"},409);
  const day=Number(draft.post.day);
  const imageKey="image:"+day;
  const existing=await env.CEO_NOTES_KV.get(imageKey);
  const imageMetaRaw=await env.CEO_NOTES_KV.get("image-meta:"+day);
  const imageUrl=publicBase(env)+"/image/"+day;
  if(existing){
    if(!imageMetaRaw)return J({error:"existing_image_unverified"},409);
    const imageMeta=JSON.parse(imageMetaRaw);
    if(imageMeta.contentHash!==draft.contentHash)return J({error:"existing_image_content_conflict"},409);
    return J({ok:true,post:{...draft.post,status:"Ready",publishedAt:imageMeta.generatedAt,imageUrl},imageUrl,date,contentHash:draft.contentHash,reused:true});
  }
  const prompt=String(body.imagePrompt||draft.imagePrompt||"Cinematic editorial portrait, modern executive office, black and warm gold palette, no text or logos.").slice(0,2048);
  const image=await env.AI.run("@cf/black-forest-labs/flux-1-schnell",{prompt,steps:4});
  if(!image.image)return J({error:"image_generation_failed"},502);
  await env.CEO_NOTES_KV.put(imageKey,image.image);
  const publishedAt=new Date().toISOString();
  await env.CEO_NOTES_KV.put("image-meta:"+day,JSON.stringify({version:1,date,day,contentHash:draft.contentHash,generatedAt:publishedAt}));
  return J({ok:true,post:{...draft.post,status:"Ready",publishedAt,imageUrl},imageUrl,date,contentHash:draft.contentHash,reused:false,usage:{imageNeurons:image.usage?.neurons}});
}
async function publishPost(req,env){
  const body=await req.json();
  const date=String(body.date||cairoDate());
  const draftRaw=await env.CEO_NOTES_KV.get("draft:"+date);
  if(!draftRaw)return J({error:"draft_not_found"},404);
  const draft=JSON.parse(draftRaw);
  const post=body.post||body;
  const hash=await contentHash(post);
  if(Number(post.day)!==Number(draft.post.day)||hash!==draft.contentHash)return J({error:"draft_content_mismatch"},409);
  const day=Number(draft.post.day);
  const image=await env.CEO_NOTES_KV.get("image:"+day);
  if(!image)return J({error:"image_missing"},400);
  const imageMetaRaw=await env.CEO_NOTES_KV.get("image-meta:"+day);
  if(!imageMetaRaw)return J({error:"image_metadata_missing"},409);
  const imageMeta=JSON.parse(imageMetaRaw);
  if(imageMeta.contentHash!==hash)return J({error:"image_content_hash_mismatch"},409);
  const feed=await getFeed(env);
  const posts=Array.isArray(feed.posts)?feed.posts:[];
  const existing=posts.find(item=>Number(item.day)===day);
  if(existing){
    const existingHash=String(existing.contentHash||await contentHash(existing));
    if(existingHash!==hash)return J({error:"day_content_conflict",day},409);
    return J({ok:true,alreadyPublished:true,day,post:existing,imageUrl:existing.imageUrl||publicBase(env)+"/image/"+day,contentHash:hash});
  }
  const published={...draft.post,status:"Published",publishedAt:String(post.publishedAt||new Date().toISOString()),imageUrl:publicBase(env)+"/image/"+day,contentHash:hash};
  const next={version:1,posts:[...posts,published].sort((a,b)=>Number(a.day)-Number(b.day))};
  await env.CEO_NOTES_KV.put("feed",JSON.stringify(next));
  await env.CEO_NOTES_KV.put("draft:"+date,JSON.stringify({...draft,status:"published",publishedAt:published.publishedAt}));
  return J({ok:true,alreadyPublished:false,day,posts:next.posts.length,imageUrl:published.imageUrl,contentHash:hash});
}

export class CEOOutboxCoordinator {
  constructor(state,env){this.state=state;this.env=env;}
  async fetch(request){
    const url=new URL(request.url),action=url.pathname.slice(1),storage=this.state.storage.kv;
    if(request.method==="GET"&&action==="snapshot"){
      const entries=storage.list({prefix:"outbox:"});
      return J({ok:true,records:[...entries].map(([key,value])=>({key,value}))});
    }
    if(request.method!=="POST")return J({error:"method_not_allowed"},405);
    let body;
    try{body=await request.json();}catch(error){return J({error:"invalid_json"},400);}
    if(action==="lock"||action==="unlock"){
      const lockKey=String(body.key||""),token=String(body.token||"");
      if(!/^editorial:\d{4}-\d{2}-\d{2}$/.test(lockKey)||token.length<16)return J({error:"invalid_editorial_lock"},400);
      const storageKey="editorial-lock:"+lockKey,current=storage.get(storageKey)||null;
      if(action==="lock"){
        const ttlMs=Math.max(30000,Math.min(900000,Number(body.ttlMs)||900000));
        if(current&&current.expiresAt>Date.now()&&current.token!==token)return J({error:"editorial_operation_in_progress"},409);
        storage.put(storageKey,{token,expiresAt:Date.now()+ttlMs});
        return J({ok:true,locked:true});
      }
      if(!current||current.token!==token)return J({error:"editorial_lock_not_owned"},409);
      storage.delete(storageKey);
      return J({ok:true,released:true});
    }
    const day=Number(body.day),platform=String(body.platform||""),identity=String(body.identity||""),hash=String(body.contentHash||"");
    if(!Number.isInteger(day)||day<1||!hash||!outboxAllowed(platform,identity))return J({error:"invalid_outbox_identity_or_payload"},400);
    const key=outboxKey(platform,identity,day),now=new Date().toISOString(),current=storage.get(key)||null;
    if(action==="reserve"){
      if(current&&current.contentHash!==hash)return J({error:"outbox_content_conflict",status:current.status},409);
      if(current?.status==="succeeded")return J({ok:true,decision:"skip",status:"succeeded",receipt:current});
      if(current?.status==="attempting"||current?.status==="unknown"||current?.status==="receipt_recorded")return J({error:"reconciliation_required",decision:"blocked",status:current.status},409);
      if(current?.status==="reserved")return J({error:"reservation_already_claimed",decision:"blocked",status:"reserved"},409);
      const record={version:2,day,platform,identity,contentHash:hash,status:"reserved",createdAt:now,updatedAt:now};
      storage.put(key,record);return J({ok:true,decision:"publish",status:"reserved",key});
    }
    if(action==="start"){
      if(!current)return J({error:"reservation_missing"},409);
      if(current.contentHash!==hash)return J({error:"outbox_content_conflict"},409);
      if(current.status==="succeeded")return J({ok:true,decision:"skip",status:"succeeded",receipt:current});
      if(current.status!=="reserved")return J({error:"reconciliation_required",status:current.status},409);
      storage.put(key,{...current,status:"attempting",attemptedAt:now,updatedAt:now});
      return J({ok:true,decision:"publish",status:"attempting"});
    }
    if(action==="receipt"){
      if(!current)return J({error:"reservation_missing"},409);
      if(current.contentHash!==hash)return J({error:"outbox_content_conflict"},409);
      const postId=String(body.postId||"").trim(),permalink=String(body.permalink||"").trim();
      if(!postId||!validPlatformPermalink(platform,permalink))return J({error:"platform_post_id_and_permalink_required"},400);
      if(current.status==="succeeded"){
        if(current.postId===postId)return J({ok:true,idempotent:true,receipt:current});
        return J({error:"receipt_conflict",postId:current.postId},409);
      }
      if(current.status!=="attempting"&&current.status!=="unknown")return J({error:"publish_attempt_not_started",status:current.status},409);
      const record={...current,status:"receipt_recorded",postId,permalink,publishedAt:String(body.publishedAt||now),receiptRecordedAt:now,updatedAt:now};
      storage.put(key,record);return J({ok:true,receiptStored:true,verificationRequired:true,receipt:record});
    }
    if(action==="verify"){
      if(!current)return J({error:"reservation_missing"},409);
      if(current.contentHash!==hash)return J({error:"outbox_content_conflict"},409);
      if(current.status==="succeeded")return J({ok:true,status:"succeeded",receipt:current});
      if(current.status!=="receipt_recorded")return J({error:"receipt_verification_required",status:current.status},409);
      const expectedSource=platform==="facebook"?"facebook_graph_api":"instagram_graph_api";
      if(body.verified!==true||String(body.verifiedPostId||"")!==current.postId||String(body.verifiedPermalink||"")!==current.permalink||body.verificationSource!==expectedSource||body.verificationStatus!=="published")return J({error:"platform_lookup_attestation_required"},403);
      const record={...current,status:"succeeded",verifiedAt:now,verificationSource:expectedSource,updatedAt:now};
      storage.put(key,record);return J({ok:true,status:"succeeded",receipt:record});
    }
    if(action==="unknown"){
      if(!current)return J({error:"reservation_missing"},409);
      if(current.status==="succeeded"||current.status==="receipt_recorded")return J({ok:true,status:current.status,receipt:current});
      if(current.status!=="attempting"&&current.status!=="reserved")return J({error:"invalid_outbox_transition",status:current.status},409);
      storage.put(key,{...current,status:"unknown",reason:String(body.reason||"ambiguous_publish_outcome").slice(0,180),updatedAt:now});
      return J({ok:true,status:"unknown",reconciliationRequired:true});
    }
    if(action==="reconcile"){
      if(!current)return J({error:"reservation_missing"},409);
      if(current.contentHash!==hash)return J({error:"outbox_content_conflict"},409);
      if(current.status==="succeeded")return J({ok:true,status:"succeeded",receipt:current});
      if(current.status!=="reserved"&&current.status!=="attempting"&&current.status!=="unknown"&&current.status!=="receipt_recorded")return J({error:"reconciliation_not_required",status:current.status},409);
      if(body.action==="published"){
        const postId=String(body.postId||"").trim(),permalink=String(body.permalink||"").trim();
        if(!postId||!validPlatformPermalink(platform,permalink))return J({error:"platform_post_id_and_permalink_required"},400);
        const record={...current,status:"receipt_recorded",postId,permalink,publishedAt:String(body.publishedAt||now),receiptRecordedAt:now,reconciledAt:now,updatedAt:now};
        storage.put(key,record);return J({ok:true,status:"receipt_recorded",verificationRequired:true,receipt:record});
      }
      if(body.action==="not_published"){
        if(current.status==="receipt_recorded")return J({error:"receipt_recorded_requires_manual_review",status:current.status},409);
        if(current.status!=="reserved"&&(body.verificationSource!==(platform==="facebook"?"facebook_graph_api":"instagram_graph_api")||body.verificationStatus!=="not_found"||String(body.verifiedPostId||"")!==""))return J({error:"authoritative_not_found_lookup_required"},403);
        storage.delete(key);return J({ok:true,status:"cleared_for_retry",retryAllowed:true});
      }
      return J({error:"invalid_reconciliation_action"},400);
    }
    if(action==="status")return J({ok:true,receipt:current});
    return J({error:"not_found"},404);
  }
}
function validPlatformPermalink(platform,value){
  try{
    const url=new URL(value);
    if(url.protocol!=="https:")return false;
    const host=url.hostname.toLowerCase();
    if(platform==="facebook")return (host==="facebook.com"||host.endsWith(".facebook.com"))&&/^\/(?:[^/]+\/)?(?:posts\/|permalink\.php|[^/]+_\d+)/i.test(url.pathname);
    if(platform==="instagram")return (host==="instagram.com"||host.endsWith(".instagram.com"))&&/^\/(?:p|reel|tv)\/[A-Za-z0-9_-]+\/?$/i.test(url.pathname);
    return false;
  }catch(error){return false;}
}
export default {
  async fetch(req,env){
    const url=new URL(req.url);
    if(req.method==="OPTIONS"){
      return new Response(null,{status:204,headers:{
        "Access-Control-Allow-Origin":"https://ceo-notes.pages.dev",
        "Access-Control-Allow-Methods":"GET, POST, OPTIONS",
        "Access-Control-Allow-Headers":"Content-Type, Authorization"
      }});
    }
    if(url.pathname.startsWith("/api/")){
      if(req.method!=="POST")return J({error:"method_not_allowed"},405);
      if(!authorized(req,env))return J({error:"unauthorized"},401);
    }
    if(url.pathname==="/health"&&req.method==="GET")return J({ok:true,service:"CEO Notes AI Publisher"});
    try{
      if(req.method==="GET"&&(url.pathname==="/"||url.pathname==="/notes"||url.pathname==="/notes/")){
        const page=await fetch("https://raw.githubusercontent.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/main/notes/index.html",{cf:{cacheTtl:0}});
        if(!page.ok)return new Response("CEO Notes page unavailable",{status:502});
        let html=await page.text();
        html=html.replace("https://royalegyptgroup.pages.dev/notes/","https://ceo-notes-ai.yasser-abdelaziz83.workers.dev/notes");
        return new Response(html,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
      }
      if(req.method==="GET"&&(url.pathname==="/notes/posts.json"||url.pathname==="/feed"))return J(await getFeed(env),200,true);
      if(req.method==="GET"&&url.pathname.startsWith("/image/")){
        const day=Number(url.pathname.split("/").pop());
        const base64=await env.CEO_NOTES_KV.get("image:"+day);
        if(!base64)return J({error:"image_not_found"},404);
        const binary=Uint8Array.from(atob(base64),character=>character.charCodeAt(0));
        return new Response(binary,{headers:{"content-type":"image/jpeg","cache-control":"public, max-age=31536000","Access-Control-Allow-Origin":"*"}});
      }
      if(req.method==="POST"&&url.pathname===API_GEN_PATH)return await withEditorialLock(env,cairoDate(),()=>generatePost(env));
      if(req.method==="POST"&&(url.pathname===API_IMAGE_PATH||url.pathname===API_PUBLISH_PATH)){
        const payload=await req.clone().json();
        const date=String(payload.date||cairoDate());
        return await withEditorialLock(env,date,()=>url.pathname===API_IMAGE_PATH?generateImage(req,env):publishPost(req,env));
      }
      if(req.method==="POST"&&url.pathname.startsWith(OUTBOX_PREFIX))return await handleOutbox(req,env,url.pathname);
      return J({error:"not_found"},404);
    }catch(error){
      return J({error:"request_failed",detail:String(error?.message||error)},502);
    }
  },
  async scheduled(event,env,ctx){
    ctx.waitUntil(createBackup(env,event.scheduledTime).catch(error=>console.error("backup_failed",String(error))));
  }
};