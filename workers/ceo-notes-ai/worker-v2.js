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
  if(env.PREVIEW_MODE!=="true"){
    try{
      const response=await fetch(FEED_URL,{cf:{cacheTtl:0}});
      if(response.ok){
        const parsed=await response.json();
        if(Array.isArray(parsed.posts))seed=parsed;
      }
    }catch(error){}
  }
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

async function restoreBackup(req,env){
  if(env.PREVIEW_MODE!=="true")return J({error:"preview_restore_only"},403);
  if(!env.OUTBOX_COORDINATOR)return J({error:"outbox_coordinator_unavailable"},503);
  let body;
  try{body=await req.json();}catch(error){return J({error:"invalid_json"},400);}
  const date=String(body.date||"");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||body.confirm!=="RESTORE_PREVIEW_BACKUP")return J({error:"explicit_preview_restore_confirmation_required"},400);
  const manifestRaw=await env.CEO_NOTES_KV.get("backup:"+date+":manifest");
  if(!manifestRaw)return J({error:"backup_manifest_not_found"},404);
  let manifest;
  try{manifest=JSON.parse(manifestRaw);}catch(error){return J({error:"backup_manifest_invalid"},409);}
  if(manifest.version!==3||manifest.date!==date)return J({error:"unsupported_backup_manifest"},409);
  const feedValue=await env.CEO_NOTES_KV.get("backup:"+date+":feed");
  if(feedValue===null||await backupHash(feedValue)!==manifest.feedSha256)return J({error:"backup_feed_checksum_failed"},409);
  let feed;
  try{feed=JSON.parse(feedValue);}catch(error){return J({error:"backup_feed_invalid"},409);}
  if(!Array.isArray(feed.posts))return J({error:"backup_feed_invalid"},409);
  const postDays=feed.posts.map(post=>Number(post.day));
  if(JSON.stringify(postDays)!==JSON.stringify(manifest.postDays))return J({error:"backup_feed_manifest_mismatch"},409);
  const entries=[["feed",feedValue]];
  const groups=[
    ["imageKeys","image:"],
    ["imageMetaKeys","image-meta:"],
    ["draftKeys","draft:"],
    ["outboxKeys","outbox:"]
  ];
  const seen=new Set(["feed"]);
  for(const [field,prefix] of groups){
    if(!Array.isArray(manifest[field]))return J({error:"backup_manifest_entries_invalid",field},409);
    for(const item of manifest[field]){
      const name=String(item?.name||"");
      if(!name.startsWith(prefix)||name.includes("..")||name.startsWith("backup:")||seen.has(name))return J({error:"backup_entry_name_invalid",field},409);
      const value=await env.CEO_NOTES_KV.get("backup:"+date+":"+name);
      if(value===null||value.length!==item.length||await backupHash(value)!==item.sha256)return J({error:"backup_entry_checksum_failed",name},409);
      seen.add(name);
      entries.push([name,value]);
    }
  }
  const coordinatorValue=await env.CEO_NOTES_KV.get("backup:"+date+":outbox-coordinator");
  if(coordinatorValue===null||await backupHash(coordinatorValue)!==manifest.coordinatorOutboxSha256)return J({error:"backup_coordinator_checksum_failed"},409);
  let coordinatorRecords;
  try{coordinatorRecords=JSON.parse(coordinatorValue);}catch(error){return J({error:"backup_coordinator_invalid"},409);}
  if(!Array.isArray(coordinatorRecords)||coordinatorRecords.length!==manifest.coordinatorOutboxCount)return J({error:"backup_coordinator_manifest_mismatch"},409);
  const byDay=new Map();
  const allowedStatuses=new Set(["reserved","attempting","unknown","receipt_recorded","succeeded"]);
  for(const record of coordinatorRecords){
    const key=String(record?.key||"");
    const match=/^outbox:(facebook:ceo-page|instagram:ceo-notes):([1-9]\d*)$/.exec(key);
    const value=record?.value;
    if(!match||!value||typeof value!=="object")return J({error:"backup_coordinator_record_invalid"},409);
    const [platform,identity]=match[1].split(":");
    const day=Number(match[2]);
    if(!manifest.postDays.includes(day)||value.version!==2||value.day!==day||value.platform!==platform||value.identity!==identity||value.targetId!==outboxTarget(platform,identity)||! /^[a-f0-9]{64}$/i.test(String(value.contentHash||""))||!allowedStatuses.has(value.status))return J({error:"backup_coordinator_identity_invalid",key},409);
    const list=byDay.get(day)||[];
    list.push({key,value});
    byDay.set(day,list);
  }
  const currentFeed=await env.CEO_NOTES_KV.get("feed");
  if(currentFeed!==null&&currentFeed!==feedValue){
    try{
      const parsed=JSON.parse(currentFeed);
      if(!Array.isArray(parsed.posts)||parsed.posts.length!==0)return J({error:"preview_target_not_empty"},409);
    }catch(error){return J({error:"preview_target_not_empty"},409);}
  }
  const restoredNames=new Set(entries.map(([key])=>key));
  for(const prefix of ["image:","image-meta:","draft:","outbox:"]){
    const page=await env.CEO_NOTES_KV.list({prefix,limit:1000});
    if(page.list_complete===false)return J({error:"preview_target_scan_incomplete",prefix},409);
    for(const item of page.keys||[])if(!restoredNames.has(item.name))return J({error:"preview_target_not_empty",key:item.name},409);
  }
  for(const [key,value] of entries){
    if(key==="feed")continue;
    const current=await env.CEO_NOTES_KV.get(key);
    if(current!==null&&current!==value)return J({error:"preview_target_conflict",key},409);
  }
  const coordinatorCalls=[];
  for(const dayValue of manifest.postDays){
    const day=Number(dayValue),records=byDay.get(day)||[];
    const coordinator=env.OUTBOX_COORDINATOR.get(env.OUTBOX_COORDINATOR.idFromName("ceo-notes-day:"+day));
    const payload=JSON.stringify({records});
    const validation=await coordinator.fetch("https://outbox-coordinator/validate-restore",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:payload
    });
    if(!validation.ok)return J({error:"coordinator_restore_preflight_failed",day,status:validation.status},409);
    coordinatorCalls.push({coordinator,payload,day});
  }
  for(const item of coordinatorCalls){
    const response=await item.coordinator.fetch("https://outbox-coordinator/restore",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:item.payload
    });
    if(!response.ok)return J({error:"coordinator_restore_failed",day:item.day,status:response.status},409);
  }
  for(const [key,value] of entries)await env.CEO_NOTES_KV.put(key,value);
  return J({
    ok:true,
    restored:true,
    previewOnly:true,
    date,
    feedPosts:feed.posts.length,
    images:manifest.imageKeys.length,
    imageMetadata:manifest.imageMetaKeys.length,
    drafts:manifest.draftKeys.length,
    legacyOutbox:manifest.outboxKeys.length,
    coordinatorOutbox:coordinatorRecords.length
  });
}

function outboxTarget(platform,identity){
  const targets={
    facebook:{"ceo-page":"115226621594988"},
    instagram:{"ceo-notes":"17841402949410977"}
  };
  return targets[platform]?.[identity]||"";
}
function outboxAllowed(platform,identity){return Boolean(outboxTarget(platform,identity));}
function outboxKey(platform,identity,day){
  return "outbox:"+platform+":"+identity+":"+day;
}
async function validateOutboxContext(env,body){
  const day=Number(body.day);
  const platform=String(body.platform||"");
  const identity=String(body.identity||"");
  const hash=String(body.contentHash||"");
  const targetId=outboxTarget(platform,identity);
  if(!Number.isInteger(day)||day<1||!hash||!targetId){
    return {error:J({error:"invalid_outbox_identity_or_payload"},400)};
  }
  const feed=await getFeed(env);
  const post=(feed.posts||[]).find(item=>Number(item.day)===day&&item.status==="Published");
  if(!post)return {error:J({error:"published_post_not_found"},404)};
  const savedHash=String(post.contentHash||await contentHash(post));
  if(savedHash!==hash)return {error:J({error:"content_hash_mismatch"},409)};
  return {day,platform,identity,hash,targetId,key:outboxKey(platform,identity,day)};
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

async function metaPublicationReadBack(env,platform,postId){
  const token=platform==="facebook"?env.META_FACEBOOK_PAGE_ACCESS_TOKEN:env.META_INSTAGRAM_ACCESS_TOKEN;
  if(typeof token!=="string"||token.length<20)return {ok:false,status:503,error:"meta_credentials_unavailable"};
  const version=String(env.META_GRAPH_API_VERSION||"v27.0");
  if(!/^v\d+\.\d+$/.test(version))return {ok:false,status:503,error:"meta_api_version_invalid"};
  const fields=platform==="facebook"?"id,from{id},permalink_url,is_published":"id,owner,permalink,timestamp";
  const endpoint=new URL("https://graph.facebook.com/"+version+"/"+encodeURIComponent(postId));
  endpoint.searchParams.set("fields",fields);
  let response;
  try{
    response=await fetch(endpoint.toString(),{headers:{Authorization:"Bearer "+token}});
  }catch(error){
    return {ok:false,status:502,error:"meta_readback_unavailable"};
  }
  let data;
  try{data=await response.json();}catch(error){return {ok:false,status:502,error:"meta_readback_invalid_response"};}
  if(!response.ok)return {ok:false,status:502,error:"meta_readback_failed",metaErrorCode:Number(data?.error?.code)||null};
  const id=String(data?.id||"");
  const targetId=platform==="facebook"?String(data?.from?.id||""):String(data?.owner?.id||data?.owner||"");
  const permalink=String(platform==="facebook"?data?.permalink_url||"":data?.permalink||"");
  const published=platform==="facebook"?data?.is_published===true:Boolean(data?.timestamp&&permalink);
  if(!id||!targetId||!permalink||!published)return {ok:false,status:409,error:"meta_publication_not_verified"};
  return {ok:true,id,targetId,permalink,published};
}
async function handleOutbox(req,env,path){
  if(!env.OUTBOX_COORDINATOR)return J({error:"outbox_coordinator_unavailable"},503);
  const body=await req.json();
  const context=await validateOutboxContext(env,body);
  if(context.error)return context.error;
  const action=path.slice(OUTBOX_PREFIX.length);
  const id=env.OUTBOX_COORDINATOR.idFromName("ceo-notes-day:"+context.day);
  const stub=env.OUTBOX_COORDINATOR.get(id);
  const scoped={...body,day:context.day,platform:context.platform,identity:context.identity,contentHash:context.hash,targetId:context.targetId};
  const internal=(name,payload)=>stub.fetch("https://outbox-coordinator/"+name,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify(payload)
  });
  if(action==="verify"){
    const statusResponse=await internal("status",scoped);
    const statusData=await statusResponse.json();
    const receipt=statusData.receipt;
    if(!receipt||receipt.status!=="receipt_recorded")return J({error:"receipt_verification_required",status:receipt?.status||"missing"},409);
    const proof=await metaPublicationReadBack(env,context.platform,receipt.postId);
    if(!proof.ok)return J({error:proof.error,metaErrorCode:proof.metaErrorCode||undefined},proof.status);
    if(proof.id!==receipt.postId||proof.targetId!==context.targetId||proof.permalink!==receipt.permalink||!proof.published){
      return J({error:"platform_readback_mismatch"},409);
    }
    const expectedSource=context.platform==="facebook"?"facebook_graph_api":"instagram_graph_api";
    const response=await internal("verify",{...scoped,verified:true,verifiedPostId:proof.id,verifiedPermalink:proof.permalink,verifiedTargetId:proof.targetId,verificationSource:expectedSource,verificationStatus:"published"});
    return new Response(response.body,{status:response.status,headers:response.headers});
  }
  if(action==="reconcile"&&body.action==="published"){
    const postId=String(body.postId||"").trim();
    if(!postId)return J({error:"post_id_required_for_reconciliation"},400);
    const proof=await metaPublicationReadBack(env,context.platform,postId);
    if(!proof.ok)return J({error:proof.error,metaErrorCode:proof.metaErrorCode||undefined},proof.status);
    if(proof.id!==postId||proof.targetId!==context.targetId||proof.permalink!==String(body.permalink||"")||!proof.published){
      return J({error:"platform_readback_mismatch"},409);
    }
    const expectedSource=context.platform==="facebook"?"facebook_graph_api":"instagram_graph_api";
    const response=await internal("reconcile",{...scoped,action:"published",postId:proof.id,permalink:proof.permalink,verifiedTargetId:proof.targetId,verificationSource:expectedSource,verificationStatus:"published"});
    return new Response(response.body,{status:response.status,headers:response.headers});
  }
  if(action==="reconcile"&&body.action==="not_published"){
    const statusResponse=await internal("status",scoped);
    const statusData=await statusResponse.json();
    const status=statusData.receipt?.status;
    if(status!=="reserved")return J({error:"authoritative_absence_check_required",manualReviewRequired:true,status:status||"missing"},409);
  }
  const response=await internal(action,scoped);
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
    if(action==="restore"||action==="validate-restore"){
      if(!Array.isArray(body.records)||body.records.length>1000)return J({error:"invalid_restore_records"},400);
      const validated=[],allowedStatuses=new Set(["reserved","attempting","unknown","receipt_recorded","succeeded"]);
      for(const record of body.records){
        const key=String(record?.key||""),value=record?.value;
        const match=/^outbox:(facebook:ceo-page|instagram:ceo-notes):([1-9]\d*)$/.exec(key);
        if(!match||!value||typeof value!=="object")return J({error:"invalid_restore_record"},400);
        const [platform,identity]=match[1].split(":"),day=Number(match[2]);
        if(value.day!==day||value.platform!==platform||value.identity!==identity||value.targetId!==outboxTarget(platform,identity)||! /^[a-f0-9]{64}$/i.test(String(value.contentHash||""))||!allowedStatuses.has(value.status))return J({error:"invalid_restore_identity"},400);
        const existing=storage.get(key)||null;
        if(existing&&JSON.stringify(existing)!==JSON.stringify(value))return J({error:"restore_record_conflict",key},409);
        validated.push({key,value,existing});
      }
      const incoming=new Map(validated.map(item=>[item.key,item.value]));
      for(const [existingKey,existingValue] of storage.list({prefix:"outbox:"})){
        if(!incoming.has(existingKey)||JSON.stringify(existingValue)!==JSON.stringify(incoming.get(existingKey)))return J({error:"restore_target_not_empty",key:existingKey},409);
      }
      for(const [lockKey,lockValue] of storage.list({prefix:"editorial-lock:"})){
        if(Number(lockValue?.expiresAt)>Date.now())return J({error:"editorial_operation_in_progress",key:lockKey},409);
      }
      if(action==="validate-restore")return J({ok:true,ready:true,records:validated.length,alreadyPresent:validated.filter(item=>item.existing).length});
      for(const item of validated)if(!item.existing)storage.put(item.key,item.value);
      return J({ok:true,restored:validated.filter(item=>!item.existing).length,alreadyPresent:validated.filter(item=>item.existing).length});
    }
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
    const day=Number(body.day),platform=String(body.platform||""),identity=String(body.identity||""),hash=String(body.contentHash||""),targetId=String(body.targetId||"");
    if(!Number.isInteger(day)||day<1||!hash||!targetId||targetId!==outboxTarget(platform,identity))return J({error:"invalid_outbox_identity_or_payload"},400);
    const key=outboxKey(platform,identity,day),now=new Date().toISOString(),current=storage.get(key)||null;
    if(current&&current.targetId!==targetId)return J({error:"outbox_target_conflict"},409);
    if(action==="reserve"){
      if(current&&current.contentHash!==hash)return J({error:"outbox_content_conflict",status:current.status},409);
      if(current?.status==="succeeded")return J({ok:true,decision:"skip",status:"succeeded",receipt:current});
      if(current?.status==="attempting"||current?.status==="unknown"||current?.status==="receipt_recorded")return J({error:"reconciliation_required",decision:"blocked",status:current.status},409);
      if(current?.status==="reserved")return J({error:"reservation_already_claimed",decision:"blocked",status:"reserved"},409);
      const record={version:2,day,platform,identity,targetId,contentHash:hash,status:"reserved",createdAt:now,updatedAt:now};
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
      if(body.verified!==true||String(body.verifiedPostId||"")!==current.postId||String(body.verifiedPermalink||"")!==current.permalink||String(body.verifiedTargetId||"")!==current.targetId||body.verificationSource!==expectedSource||body.verificationStatus!=="published")return J({error:"platform_lookup_attestation_required"},403);
      const record={...current,status:"succeeded",verifiedAt:now,verifiedTargetId:current.targetId,verificationSource:expectedSource,updatedAt:now};
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
        const expectedSource=platform==="facebook"?"facebook_graph_api":"instagram_graph_api";
        if(String(body.verifiedTargetId||"")!==current.targetId||body.verificationSource!==expectedSource||body.verificationStatus!=="published")return J({error:"platform_lookup_attestation_required"},403);
        if(!postId||!validPlatformPermalink(platform,permalink))return J({error:"platform_post_id_and_permalink_required"},400);
        const record={...current,status:"receipt_recorded",postId,permalink,publishedAt:String(body.publishedAt||now),receiptRecordedAt:now,reconciledAt:now,updatedAt:now};
        storage.put(key,record);return J({ok:true,status:"receipt_recorded",verificationRequired:true,receipt:record});
      }
      if(body.action==="not_published"){
        if(current.status==="receipt_recorded")return J({error:"receipt_recorded_requires_manual_review",status:current.status},409);
        if(current.status!=="reserved"&&(body.verificationSource!==(platform==="facebook"?"facebook_graph_api":"instagram_graph_api")||body.verificationStatus!=="not_found"||String(body.verifiedTargetId||"")!==current.targetId||String(body.verifiedPostId||"")!==""))return J({error:"authoritative_not_found_lookup_required"},403);
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
    if(url.pathname==="/health"&&req.method==="GET"){
      const health={ok:true,service:"CEO Notes AI Publisher",kvConfigured:!!env.CEO_NOTES_KV,aiConfigured:!!env.AI,outboxCoordinatorConfigured:!!env.OUTBOX_COORDINATOR,outboxCoordinatorReady:false};
      if(env.OUTBOX_COORDINATOR){
        const stub=env.OUTBOX_COORDINATOR.get(env.OUTBOX_COORDINATOR.idFromName("ceo-notes-health"));
        const check=await stub.fetch("https://outbox-coordinator/snapshot");
        health.outboxCoordinatorReady=check.ok;
        if(!check.ok)health.ok=false;
      }else health.ok=false;
      if(!health.kvConfigured)health.ok=false;
      return J(health,health.ok?200:503);
    }
    try{
      if(req.method==="GET"&&url.pathname==="/")return J({ok:true,service:"CEO Notes AI Publisher",mode:env.PREVIEW_MODE==="true"?"preview":"production"});
      if(req.method==="GET"&&(url.pathname==="/notes/posts.json"||url.pathname==="/feed"))return J(await getFeed(env),200,true);
      if(req.method==="GET"&&url.pathname.startsWith("/image/")){
        const day=Number(url.pathname.split("/").pop());
        const base64=await env.CEO_NOTES_KV.get("image:"+day);
        if(!base64)return J({error:"image_not_found"},404);
        const binary=Uint8Array.from(atob(base64),character=>character.charCodeAt(0));
        return new Response(binary,{headers:{"content-type":"image/jpeg","cache-control":"public, max-age=31536000","Access-Control-Allow-Origin":"*"}});
      }
      if(req.method==="POST"&&url.pathname==="/api/backup/restore")return await restoreBackup(req,env);
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