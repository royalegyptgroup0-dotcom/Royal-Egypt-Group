const API_GEN_PATH="/api/generate";
const API_IMAGE_PATH="/api/image";
const API_PUBLISH_PATH="/api/publish";
const OUTBOX_PREFIX="/api/outbox/";
const FEED_URL="https://raw.githubusercontent.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/ceo-notes-site/notes/posts.json";
const PUBLIC_BASE="https://ceo-notes-ai.yasser-abdelaziz83.workers.dev";
function publicBase(env){return String(env.PUBLIC_BASE||PUBLIC_BASE).replace(/\/+$/,"");}

async function authorized(req,env,ctx){
  if(ctx?.access&&typeof ctx.access.getIdentity==="function"){
    try{const identity=await ctx.access.getIdentity();if(identity)return true;}catch(error){}
  }
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
  const computedHash=await contentHash(post);
  const savedHash=String(post.contentHash||computedHash);
  if(savedHash!==computedHash||computedHash!==hash)return {error:J({error:"content_hash_mismatch"},409)};
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
async function metaGraphRequest(env,platform,path,method="GET",params={}){
  const token=platform==="facebook"?env.META_FACEBOOK_PAGE_ACCESS_TOKEN:env.META_INSTAGRAM_ACCESS_TOKEN;
  if(typeof token!=="string"||token.length<20)throw new Error("meta_credentials_unavailable");
  const version=String(env.META_GRAPH_API_VERSION||"v27.0");
  if(!/^v\d+\.\d+$/.test(version))throw new Error("meta_api_version_invalid");
  const endpoint=new URL("https://graph.facebook.com/"+version+"/"+String(path).split("/").map(encodeURIComponent).join("/"));
  const headers={Authorization:"Bearer "+token};
  const init={method,headers};
  if(method==="GET"){
    for(const [key,value] of Object.entries(params))if(value!==undefined&&value!==null)endpoint.searchParams.set(key,String(value));
  }else{
    init.body=new URLSearchParams(Object.entries(params).filter(([,value])=>value!==undefined&&value!==null).map(([key,value])=>[key,String(value)]));
    headers["content-type"]="application/x-www-form-urlencoded";
  }
  let response;
  try{response=await fetch(endpoint.toString(),init);}catch(error){throw new Error("meta_network_failure");}
  let data;
  try{data=await response.json();}catch(error){throw new Error("meta_invalid_response");}
  if(!response.ok||data?.error)throw new Error("meta_api_error_"+(Number(data?.error?.code)||response.status));
  return data;
}
function socialCaption(post){
  return [
    post.title,
    post.article,
    "فكرة اليوم: "+post.ideaOfTheDay,
    "تحدي CEO: "+post.ceoChallenge,
    "سؤال للنقاش: "+post.discussionQuestion,
    post.hashtags
  ].filter(Boolean).join("\n\n").trim();
}
async function publishFacebookPost(env,post,imageUrl){
  const caption=socialCaption(post);
  const result=await metaGraphRequest(env,"facebook",outboxTarget("facebook","ceo-page")+"/photos","POST",{
    url:imageUrl,
    caption,
    published:"true"
  });
  const postId=String(result.post_id||"");
  if(!postId)throw new Error("meta_facebook_post_id_missing");
  return postId;
}
async function publishInstagramPost(env,post,imageUrl){
  const caption=socialCaption(post);
  if(caption.length>2200)throw new Error("instagram_caption_too_long");
  const target=outboxTarget("instagram","ceo-notes");
  const container=await metaGraphRequest(env,"instagram",target+"/media","POST",{image_url:imageUrl,caption});
  const creationId=String(container.id||"");
  if(!creationId)throw new Error("meta_instagram_container_id_missing");
  let ready=false;
  for(let attempt=0;attempt<6;attempt++){
    const status=await metaGraphRequest(env,"instagram",creationId,"GET",{fields:"status_code"});
    if(status.status_code==="FINISHED"){ready=true;break;}
    if(status.status_code==="ERROR")throw new Error("meta_instagram_container_failed");
    if(status.status_code!=="IN_PROGRESS")throw new Error("meta_instagram_container_status_unknown");
    if(attempt<5)await new Promise(resolve=>setTimeout(resolve,1500));
  }
  if(!ready)throw new Error("meta_instagram_container_timeout");
  const published=await metaGraphRequest(env,"instagram",target+"/media_publish","POST",{creation_id:creationId});
  const postId=String(published.id||"");
  if(!postId)throw new Error("meta_instagram_post_id_missing");
  return postId;
}
async function approvalFor(env,context){
  const stub=env.OUTBOX_COORDINATOR.get(env.OUTBOX_COORDINATOR.idFromName("ceo-notes-day:"+context.day));
  const response=await stub.fetch("https://outbox-coordinator/approval-status",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({day:context.day,platform:context.platform,identity:context.identity,targetId:context.targetId,contentHash:context.hash})
  });
  const data=await response.json();
  return data.approval||null;
}
async function handleApproval(req,env,action){
  const body=await req.json();
  const context=await validateOutboxContext(env,body);
  if(context.error)return context.error;
  if(action==="approve"){
    if(body.confirm!=="APPROVE_CEO_NOTES_PUBLICATION")return J({error:"explicit_owner_approval_confirmation_required"},400);
    const scheduledFor=body.scheduledFor?String(body.scheduledFor):null;
    if(scheduledFor&&(!Number.isFinite(Date.parse(scheduledFor))||!/(Z|[+-]\d{2}:\d{2})$/i.test(scheduledFor)))return J({error:"scheduled_for_must_be_offset_aware_iso"},400);
    if(scheduledFor&&Date.parse(scheduledFor)<=Date.now())return J({error:"scheduled_for_must_be_in_the_future"},400);
  }
  const stub=env.OUTBOX_COORDINATOR.get(env.OUTBOX_COORDINATOR.idFromName("ceo-notes-day:"+context.day));
  const response=await stub.fetch("https://outbox-coordinator/"+action,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({...body,day:context.day,platform:context.platform,identity:context.identity,targetId:context.targetId,contentHash:context.hash})
  });
  return new Response(response.body,{status:response.status,headers:response.headers});
}
async function publishSocialPostCore(env,body){
  const context=await validateOutboxContext(env,body);
  if(context.error)return context.error;
  const approval=await approvalFor(env,context);
  if(!approval||approval.contentHash!==context.hash||approval.targetId!==context.targetId)return J({error:"owner_approval_required_for_exact_content"},403);
  if(approval.scheduledFor&&Date.parse(approval.scheduledFor)>Date.now())return J({error:"publication_not_due",scheduledFor:approval.scheduledFor},409);
  const token=context.platform==="facebook"?env.META_FACEBOOK_PAGE_ACCESS_TOKEN:env.META_INSTAGRAM_ACCESS_TOKEN;
  if(typeof token!=="string"||token.length<20)return J({error:"meta_credentials_unavailable"},503);
  const imageMetaRaw=await env.CEO_NOTES_KV.get("image-meta:"+context.day);
  if(!imageMetaRaw)return J({error:"approved_image_metadata_missing"},409);
  let imageMeta;
  try{imageMeta=JSON.parse(imageMetaRaw);}catch(error){return J({error:"image_metadata_invalid"},409);}
  if(imageMeta.contentHash!==context.hash)return J({error:"approved_image_content_mismatch"},409);
  if(!(await env.CEO_NOTES_KV.get("image:"+context.day)))return J({error:"approved_image_missing"},404);
  const feed=await getFeed(env);
  const post=(feed.posts||[]).find(item=>Number(item.day)===context.day);
  if(!post)return J({error:"published_post_not_found"},404);
  if(context.platform==="instagram"&&socialCaption(post).length>2200)return J({error:"instagram_caption_too_long",limit:2200},413);
  const imageUrl=publicBase(env)+"/image/"+context.day;
  const stub=env.OUTBOX_COORDINATOR.get(env.OUTBOX_COORDINATOR.idFromName("ceo-notes-day:"+context.day));
  const scoped={day:context.day,platform:context.platform,identity:context.identity,targetId:context.targetId,contentHash:context.hash};
  const internal=(action,payload)=>stub.fetch("https://outbox-coordinator/"+action,{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)
  });
  const reserved=await internal("reserve",scoped);
  const reserveData=await reserved.json();
  if(!reserved.ok)return J(reserveData,reserved.status);
  if(reserveData.decision==="skip")return J({ok:true,alreadyPublished:true,platform:context.platform,receipt:reserveData.receipt});
  const started=await internal("start",scoped);
  if(!started.ok)return new Response(started.body,{status:started.status,headers:started.headers});
  try{
    const postId=context.platform==="facebook"
      ?await publishFacebookPost(env,post,imageUrl)
      :await publishInstagramPost(env,post,imageUrl);
    const proof=await metaPublicationReadBack(env,context.platform,postId);
    if(!proof.ok||proof.id!==postId||proof.targetId!==context.targetId||!proof.permalink||!proof.published)throw new Error(proof.error||"meta_publication_readback_mismatch");
    const receipt=await internal("receipt",{...scoped,postId:proof.id,permalink:proof.permalink,publishedAt:proof.timestamp||new Date().toISOString()});
    const receiptData=await receipt.json();
    if(!receipt.ok)throw new Error(receiptData.error||"outbox_receipt_failed");
    const verified=await internal("verify",{...scoped,verified:true,verifiedPostId:proof.id,verifiedPermalink:proof.permalink,verifiedTargetId:proof.targetId,verificationSource:context.platform==="facebook"?"facebook_graph_api":"instagram_graph_api",verificationStatus:"published"});
    const verifiedData=await verified.json();
    if(!verified.ok||verifiedData.status!=="succeeded")throw new Error(verifiedData.error||"outbox_verification_failed");
    return J({ok:true,status:"succeeded",platform:context.platform,day:context.day,postId:proof.id,permalink:proof.permalink,verifiedAt:verifiedData.receipt?.verifiedAt||new Date().toISOString()});
  }catch(error){
    await internal("unknown",{...scoped,reason:String(error?.message||"meta_publish_or_verification_failed").slice(0,180)});
    return J({error:"social_publish_outcome_unknown",manualReviewRequired:true,platform:context.platform,day:context.day},502);
  }
}
async function runDueSocialPublications(env,scheduledTime){
  if(env.PREVIEW_MODE==="true"||env.PUBLISHING_ENABLED!=="true")return {skipped:true,reason:"publishing_disabled"};
  const feed=await getFeed(env),scheduledMs=typeof scheduledTime==="number"?scheduledTime:Date.parse(scheduledTime||Date.now()),now=Number.isFinite(scheduledMs)?scheduledMs:Date.now(),results=[];
  for(const post of feed.posts||[]){
    const day=Number(post.day),hash=String(post.contentHash||await contentHash(post));
    if(!Number.isInteger(day)||day<1||post.status!=="Published")continue;
    for(const [platform,identity] of [["facebook","ceo-page"],["instagram","ceo-notes"]]){
      const context={day,platform,identity,targetId:outboxTarget(platform,identity),hash};
      const approval=await approvalFor(env,context);
      if(!approval||approval.contentHash!==hash||!approval.scheduledFor||Date.parse(approval.scheduledFor)>now)continue;
      const response=await publishSocialPostCore(env,{...context,contentHash:hash});
      results.push({day,platform,status:response.status});
    }
  }
  return {processed:results.length,results};
}
async function handleDraftStatus(req,env){
  let body={};
  try{body=await req.json();}catch(error){return J({error:"invalid_json"},400);}
  const date=String(body.date||cairoDate());
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return J({error:"invalid_date"},400);
  const raw=await env.CEO_NOTES_KV.get("draft:"+date);
  if(!raw)return J({ok:true,draft:null,date});
  try{return J({ok:true,draft:JSON.parse(raw),date});}
  catch(error){return J({error:"draft_record_corrupt"},409);}
}
async function handleDraftUpdate(req,env){
  let body;
  try{body=await req.json();}catch(error){return J({error:"invalid_json"},400);}
  const date=String(body.date||cairoDate());
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return J({error:"invalid_date"},400);
  const key="draft:"+date,raw=await env.CEO_NOTES_KV.get(key);
  if(!raw)return J({error:"draft_not_found"},404);
  let existing;
  try{existing=JSON.parse(raw);}catch(error){return J({error:"draft_record_corrupt"},409);}
  if(existing.status==="published")return J({error:"published_draft_is_immutable"},409);
  const post=editorialFields({...body.post,day:existing.post.day});
  const imagePrompt=String(body.imagePrompt||existing.imagePrompt||"").trim().slice(0,2048);
  if(!post.title||post.title.length<8||post.title.length>160||!post.article||post.article.length<500||post.article.length>6000||!post.ideaOfTheDay||!post.ceoChallenge||!post.discussionQuestion||!post.hashtags||!imagePrompt){
    return J({error:"draft_quality_check_failed",articleLength:post.article.length},400);
  }
  const hash=await contentHash(post);
  const imageMetaRaw=await env.CEO_NOTES_KV.get("image-meta:"+post.day);
  if(imageMetaRaw){
    try{
      const imageMeta=JSON.parse(imageMetaRaw);
      if(imageMeta.contentHash!==hash){
        await env.CEO_NOTES_KV.delete("image:"+post.day);
        await env.CEO_NOTES_KV.delete("image-meta:"+post.day);
      }
    }catch(error){
      await env.CEO_NOTES_KV.delete("image:"+post.day);
      await env.CEO_NOTES_KV.delete("image-meta:"+post.day);
    }
  }
  const next={...existing,post,imagePrompt,contentHash:hash,updatedAt:new Date().toISOString(),status:"draft"};
  await env.CEO_NOTES_KV.put(key,JSON.stringify(next));
  return J({ok:true,draft:next,contentHash:hash,imageUrl:null});
}
async function generatePost(env){
  if(!env.AI||typeof env.AI.run!=="function")return J({error:"ai_binding_unavailable"},503);
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
  if(!env.AI||typeof env.AI.run!=="function")return J({error:"ai_binding_unavailable"},503);
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
    const computedExistingHash=await contentHash(existing);
    const existingHash=String(existing.contentHash||computedExistingHash);
    if(existingHash!==computedExistingHash)return J({error:"existing_feed_content_hash_invalid",day},409);
    if(computedExistingHash!==hash)return J({error:"day_content_conflict",day},409);
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
    const approvalKey="approval:"+platform+":"+identity+":"+day;
    if(action==="approval-status"){
      const approval=storage.get(approvalKey)||null;
      return J({ok:true,approval:approval&&approval.contentHash===hash?approval:null});
    }
    if(action==="approve"){
      if(body.confirm!=="APPROVE_CEO_NOTES_PUBLICATION")return J({error:"explicit_owner_approval_confirmation_required"},400);
      const scheduledFor=body.scheduledFor?String(body.scheduledFor):null;
      if(scheduledFor&&(!Number.isFinite(Date.parse(scheduledFor))||!/(Z|[+-]\d{2}:\d{2})$/i.test(scheduledFor)))return J({error:"scheduled_for_must_be_offset_aware_iso"},400);
      const existingApproval=storage.get(approvalKey)||null;
      if(existingApproval&&existingApproval.contentHash!==hash)return J({error:"existing_approval_content_conflict"},409);
      const currentOutbox=storage.get(outboxKey(platform,identity,day))||null;
      if(currentOutbox&&currentOutbox.status!=="reserved")return J({error:"approval_locked_after_publish_attempt"},409);
      if(existingApproval)return J({ok:true,idempotent:true,approval:existingApproval});
      const approval={version:1,approvalId:crypto.randomUUID(),day,platform,identity,targetId,contentHash:hash,approvedBy:"owner",approvedAt:new Date().toISOString(),scheduledFor};
      storage.put(approvalKey,approval);
      return J({ok:true,approval});
    }
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
const ADMIN_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>لوحة CEO Notes</title>
<style>
:root{color-scheme:dark;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#101114;color:#f4f1e9}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top,#24201a,#101114 55%);min-height:100vh}
main{max-width:1050px;margin:auto;padding:24px 16px 64px}header{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:22px}
h1{font-size:25px;margin:0;color:#e7c987}p{color:#c8c4bb;line-height:1.7}.muted{color:#99958d;font-size:13px}
.card{background:#1b1c20;border:1px solid #39352c;border-radius:16px;padding:18px;margin:14px 0}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
label{display:block;font-size:13px;color:#d9c9a6;margin:10px 0 6px}
input,textarea{width:100%;background:#111216;border:1px solid #47433a;border-radius:9px;padding:11px;color:#f5f2eb;font:inherit}
textarea{min-height:110px;resize:vertical}button{border:0;border-radius:9px;padding:11px 16px;margin:5px 4px 5px 0;background:#b9934d;color:#17130c;font-weight:700;cursor:pointer}
button.secondary{background:#34343a;color:#eee}button.danger{background:#7d3636;color:white}button:disabled{opacity:.45;cursor:not-allowed}
#status{white-space:pre-wrap;padding:12px;border-radius:9px;background:#121318;color:#cfc7b5;min-height:42px}
#image{max-width:100%;max-height:380px;display:none;border-radius:12px;margin-top:12px}
.actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.post-list{display:grid;gap:8px}.post-item{background:#131419;border:1px solid #333;padding:10px;border-radius:9px}
@media(max-width:700px){.grid{grid-template-columns:1fr}header{align-items:flex-start;flex-direction:column}}
</style>
</head>
<body><main>
<header><div><h1>CEO Notes | لوحة التحرير والنشر</h1><p class="muted">مساحة خاصة للمراجعة والاعتماد والنشر. لا يتم النشر تلقائيًا دون موافقتك.</p></div><span class="muted">توقيت القاهرة · 19:30</span></header>
<section class="card">
  <div class="actions"><button id="load">تحديث البيانات</button><button id="generate">إنشاء مسودة اليوم</button><button class="secondary" id="save">حفظ التعديلات</button><button class="secondary" id="makeImage">إنشاء الصورة</button><button class="secondary" id="publishFeed">حفظ في موقع CEO Notes</button></div>
  <div class="grid">
    <div><label for="day">رقم اليوم</label><input id="day" type="number" min="1" readonly></div>
    <div><label for="date">تاريخ التحرير (القاهرة)</label><input id="date" type="text" readonly></div>
  </div>
  <label for="title">العنوان</label><input id="title" maxlength="160">
  <label for="article">المقال</label><textarea id="article" maxlength="6000" style="min-height:260px"></textarea>
  <div class="grid">
    <div><label for="idea">فكرة اليوم</label><textarea id="idea"></textarea></div>
    <div><label for="challenge">تحدي CEO</label><textarea id="challenge"></textarea></div>
  </div>
  <label for="question">سؤال النقاش</label><textarea id="question"></textarea>
  <label for="hashtags">الهاشتاجات</label><input id="hashtags">
  <label for="prompt">وصف الصورة</label><textarea id="prompt"></textarea>
  <img id="image" alt="معاينة صورة CEO Notes">
</section>
<section class="card">
  <h2>اعتماد ونشر الشبكات الاجتماعية</h2>
  <p class="muted">كل قناة مستقلة. الاعتماد مرتبط ببصمة المحتوى الحالية، وأي تعديل يبطل الاعتماد السابق.</p>
  <label for="scheduled">موعد النشر المجدول (اختياري، بتوقيت القاهرة)</label><input id="scheduled" type="datetime-local">
  <div class="actions">
    <button id="approveFb">اعتماد Facebook</button><button class="secondary" id="publishFb">نشر Facebook الآن</button>
    <button id="approveIg">اعتماد Instagram</button><button class="secondary" id="publishIg">نشر Instagram الآن</button>
  </div>
  <p class="muted">عند تحديد موعد مستقبلي، يلزم تفعيل الجدولة الإنتاجية بعد اختبار النشر الأول وموافقة منفصلة.</p>
</section>
<section class="card"><h2>آخر المنشورات المحفوظة</h2><div id="posts" class="post-list"></div></section>
<div id="status" role="status" aria-live="polite">جارٍ تحميل المسودة...</div>
</main>
<script>
(function(){
"use strict";
var state={date:"",draft:null,post:null,contentHash:"",imageUrl:"",dirty:false};
var el=function(id){return document.getElementById(id)};
var status=function(message){el("status").textContent=String(message||"")};
var api=async function(path,body){
  var response=await fetch(path,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(body||{})});
  var data={};try{data=await response.json()}catch(e){}
  if(!response.ok)throw new Error(data.error||("HTTP "+response.status));
  return data;
};
var cairoDate=function(){
  var p=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  var v={};p.forEach(function(x){v[x.type]=x.value});return v.year+"-"+v.month+"-"+v.day;
};
var cairoIso=function(value){
  if(!value)return null;
  var parts=value.split("T"),d=parts[0].split("-").map(Number),t=parts[1].split(":").map(Number);
  var guess=Date.UTC(d[0],d[1]-1,d[2],t[0],t[1]);
  var fmt=new Intl.DateTimeFormat("en-US",{timeZone:"Africa/Cairo",timeZoneName:"longOffset"});
  var offset=fmt.formatToParts(new Date(guess)).find(function(x){return x.type==="timeZoneName"}).value;
  var match=/GMT([+-])(\\d{2}):?(\\d{2})/.exec(offset);
  if(!match)throw new Error("تعذر تحديد توقيت القاهرة");
  var minutes=(Number(match[2])*60+Number(match[3]))*(match[1]==="-"?-1:1);
  return new Date(guess-minutes*60000).toISOString();
};
var readForm=function(){
  return {day:Number(el("day").value),title:el("title").value,article:el("article").value,ideaOfTheDay:el("idea").value,ceoChallenge:el("challenge").value,discussionQuestion:el("question").value,hashtags:el("hashtags").value};
};
var showDraft=function(draft){
  state.draft=draft;state.post=draft.post;state.contentHash=draft.contentHash;state.date=draft.date;state.dirty=false;
  el("date").value=draft.date;el("day").value=draft.post.day;el("title").value=draft.post.title||"";
  el("article").value=draft.post.article||"";el("idea").value=draft.post.ideaOfTheDay||"";
  el("challenge").value=draft.post.ceoChallenge||"";el("question").value=draft.post.discussionQuestion||"";
  el("hashtags").value=draft.post.hashtags||"";el("prompt").value=draft.imagePrompt||"";
  state.imageUrl=draft.imageUrl||"";
  if(state.imageUrl){el("image").src=state.imageUrl;el("image").style.display="block"}else{el("image").removeAttribute("src");el("image").style.display="none"}
};
var load=async function(){
  state.date=cairoDate();el("date").value=state.date;
  var data=await api("/api/draft/status",{date:state.date});
  if(data.draft)showDraft(data.draft);
  else{state.draft=null;state.post=null;state.contentHash="";el("day").value="";status("لا توجد مسودة لهذا اليوم. يمكنك إنشاء مسودة جديدة.")}
  var feed=await fetch("/feed",{credentials:"same-origin"}).then(function(r){if(!r.ok)throw new Error("feed_unavailable");return r.json()});
  var posts=(feed.posts||[]).slice(-8).reverse();el("posts").textContent="";
  posts.forEach(function(p){var item=document.createElement("div");item.className="post-item";item.textContent="اليوم "+p.day+" · "+p.title+" · "+p.status;el("posts").appendChild(item)});
};
var save=async function(){
  if(!state.draft)throw new Error("أنشئ مسودة أولًا");
  if(!state.dirty)return;
  var data=await api("/api/draft/update",{date:state.date,post:readForm(),imagePrompt:el("prompt").value});
  showDraft(data.draft);status("تم حفظ التعديلات وتحديث بصمة المحتوى. إذا تغير المقال ستحتاج إلى إنشاء صورة جديدة وإعادة الاعتماد.");
};
var approve=async function(platform){
  if(!state.post||!state.contentHash)throw new Error("لا توجد مسودة محفوظة");
  if(state.dirty)await save();
  var name=platform==="facebook"?"صفحة CEO على Facebook":"حساب CEO Notes على Instagram";
  if(!window.confirm("اعتماد اليوم "+state.post.day+" على "+name+" للمحتوى الحالي؟"))return;
  var scheduled=el("scheduled").value?cairoIso(el("scheduled").value):null;
  var data=await api("/api/approval/approve",{day:state.post.day,platform:platform,identity:platform==="facebook"?"ceo-page":"ceo-notes",contentHash:state.contentHash,confirm:"APPROVE_CEO_NOTES_PUBLICATION",scheduledFor:scheduled});
  status("تم تسجيل الاعتماد لـ"+name+(scheduled?" بموعد "+scheduled:" دون جدولة. النشر اليدوي متاح بعد ذلك."));
};
var publish=async function(platform){
  if(!state.post||!state.contentHash)throw new Error("لا توجد مسودة محفوظة");
  if(state.dirty)await save();
  var name=platform==="facebook"?"Facebook":"Instagram";
  if(!window.confirm("تنفيذ نشر عام الآن على "+name+" لليوم "+state.post.day+"؟"))return;
  var data=await api("/api/social/publish",{day:state.post.day,platform:platform,identity:platform==="facebook"?"ceo-page":"ceo-notes",contentHash:state.contentHash});
  status("تم النشر والتحقق: "+data.permalink);
};
var run=async function(action){
  try{status("جارٍ التنفيذ...");await action()}catch(error){status("تعذر التنفيذ: "+error.message)}
};
el("load").addEventListener("click",function(){run(load)});
el("generate").addEventListener("click",function(){run(async function(){var d=await api("/api/generate",{});showDraft({date:d.date,post:d.post,imagePrompt:d.imagePrompt,contentHash:d.contentHash});status("تم إنشاء المسودة. راجعها وعدّلها قبل إنشاء الصورة أو حفظها في الموقع.")})});
el("save").addEventListener("click",function(){run(save)});
el("makeImage").addEventListener("click",function(){run(async function(){await save();var d=await api("/api/image",{date:state.date,post:readForm(),imagePrompt:el("prompt").value});state.imageUrl=d.imageUrl;el("image").src=d.imageUrl;el("image").style.display="block";status("تم إنشاء الصورة وربطها ببصمة المحتوى الحالية.")})});
el("publishFeed").addEventListener("click",function(){run(async function(){await save();var d=await api("/api/publish",{date:state.date,post:readForm()});status(d.alreadyPublished?"المقال موجود بالفعل في الموقع.":"تم حفظ المقال في موقع CEO Notes. لم يتم نشره اجتماعيًا.")})});
el("approveFb").addEventListener("click",function(){run(function(){return approve("facebook")})});
el("approveIg").addEventListener("click",function(){run(function(){return approve("instagram")})});
el("publishFb").addEventListener("click",function(){run(function(){return publish("facebook")})});
el("publishIg").addEventListener("click",function(){run(function(){return publish("instagram")})});
["title","article","idea","challenge","question","hashtags","prompt"].forEach(function(id){el(id).addEventListener("input",function(){state.dirty=true})});
run(load);
})();
</script></body></html>`;
export default {
  async fetch(req,env,ctx){
    const url=new URL(req.url);
    if(req.method==="OPTIONS"){
      return new Response(null,{status:204,headers:{
        "Access-Control-Allow-Origin":"https://ceo-notes.pages.dev",
        "Access-Control-Allow-Methods":"GET, POST, OPTIONS",
        "Access-Control-Allow-Headers":"Content-Type, Authorization"
      }});
    }
    if((url.pathname==="/admin"||url.pathname==="/admin/")&&req.method==="GET"){
      let identity=null;
      try{identity=ctx?.access?.getIdentity?await ctx.access.getIdentity():null;}catch(error){}
      if(!identity)return J({error:"access_authentication_required"},401);
      return new Response(ADMIN_HTML,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer","content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"}});
    }
    if(url.pathname.startsWith("/api/")){
      if(req.method!=="POST")return J({error:"method_not_allowed"},405);
      if(!await authorized(req,env,ctx))return J({error:"unauthorized"},401);
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
      if(req.method==="POST"&&url.pathname==="/api/draft/status")return await handleDraftStatus(req,env);
      if(req.method==="POST"&&url.pathname==="/api/draft/update")return await handleDraftUpdate(req,env);
      if(req.method==="POST"&&url.pathname==="/api/approval/approve")return await handleApproval(req,env,"approve");
      if(req.method==="POST"&&url.pathname==="/api/approval/status")return await handleApproval(req,env,"approval-status");
      if(req.method==="POST"&&url.pathname==="/api/social/publish")return await publishSocialPostCore(env,await req.json());
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
    const cron=String(event.cron||"");
    if(cron!=="*/15 * * * *")ctx.waitUntil(createBackup(env,event.scheduledTime).catch(error=>console.error("backup_failed")));
    if(cron==="*/15 * * * *"&&env.PUBLISHING_ENABLED==="true"&&env.PREVIEW_MODE!=="true"){
      const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Cairo",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(event.scheduledTime||Date.now()));
      const clock=parts.find(item=>item.type==="hour")?.value+":"+parts.find(item=>item.type==="minute")?.value;
      if(clock==="19:30")ctx.waitUntil(runDueSocialPublications(env,event.scheduledTime).catch(error=>console.error("scheduled_publishing_failed")));
    }
  }
};