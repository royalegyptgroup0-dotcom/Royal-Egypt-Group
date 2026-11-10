const GEN_PATH="/generate-29c05f7671553fc8deca920ac4cc832479fc22c01d5691a2",IMAGE_PATH="/image-29c05f7671553fc8deca920ac4cc832479fc22c01d5691a2",PUBLISH_PATH="/publish-29c05f7671553fc8deca920ac4cc832479fc22c01d5691a2";
const FEED_URL="https://raw.githubusercontent.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/ceo-notes-site/notes/posts.json";
const PUBLIC_BASE="https://ceo-notes-ai.yasser-abdelaziz83.workers.dev";
function authorized(req,env){const token=env.ADMIN_TOKEN;return typeof token==="string"&&token.length>=32&&req.headers.get("Authorization")==="Bearer "+token;}
const J=(x,s=200,cors=false)=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...(cors?{"Access-Control-Allow-Origin":"https://royalegyptgroup.pages.dev","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type"}:{})}});
async function getFeed(env){const saved=await env.CEO_NOTES_KV.get("feed");if(saved){try{return JSON.parse(saved);}catch(e){}}let seed={version:1,posts:[]};try{const r=await fetch(FEED_URL,{cf:{cacheTtl:0}});if(r.ok)seed=await r.json();}catch(e){}await env.CEO_NOTES_KV.put("feed",JSON.stringify(seed));return seed;}
function parse(s){if(typeof s!=="string")throw new Error("missing AI text");const a=s.indexOf("{"),b=s.lastIndexOf("}");if(a<0||b<=a)throw new Error("invalid AI JSON");return JSON.parse(s.slice(a,b+1));}
async function backupHash(value){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");}
async function createBackup(env,scheduledTime){
 const now=new Date(scheduledTime||Date.now()),date=now.toISOString().slice(0,10),feed=await getFeed(env),feedValue=JSON.stringify(feed);
 const feedSha256=await backupHash(feedValue),imagePage=await env.CEO_NOTES_KV.list({prefix:"image:",limit:1000}),imageKeys=[];
 await env.CEO_NOTES_KV.put("backup:"+date+":feed",feedValue);
 for(const item of imagePage.keys||[]){const value=await env.CEO_NOTES_KV.get(item.name);if(value!==null){const imageValue=String(value),suffix=item.name.slice(6);await env.CEO_NOTES_KV.put("backup:"+date+":image:"+suffix,imageValue);imageKeys.push({name:item.name,length:imageValue.length,sha256:await backupHash(imageValue)});}}
 const manifest={version:1,date,createdAt:now.toISOString(),feedSha256,postDays:(feed.posts||[]).map(p=>Number(p.day)),imageKeys};
 await env.CEO_NOTES_KV.put("backup:"+date+":manifest",JSON.stringify(manifest));
 const all=await env.CEO_NOTES_KV.list({prefix:"backup:",limit:1000}),dates=[...new Set((all.keys||[]).map(k=>k.name.split(":")[1]).filter(Boolean))].sort(),stale=dates.slice(0,Math.max(0,dates.length-30));
 for(const oldDate of stale){const old=await env.CEO_NOTES_KV.list({prefix:"backup:"+oldDate+":",limit:1000});for(const item of old.keys||[])await env.CEO_NOTES_KV.delete(item.name);}
 return {date,postCount:(feed.posts||[]).length,imageCount:imageKeys.length,feedSha256,retainedDays:Math.min(dates.length,30)};
}
export default {async fetch(req,env){
 const u=new URL(req.url);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":"https://royalegyptgroup.pages.dev","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type"}});
 if((req.method==="POST"&&(u.pathname===GEN_PATH||u.pathname===PUBLISH_PATH))||(req.method==="GET"&&(u.pathname===IMAGE_PATH||u.pathname===PUBLISH_PATH))){if(!authorized(req,env))return J({error:"unauthorized"},401);}
 if(u.pathname==="/health")return J({ok:true,service:"CEO Notes AI Publisher"});
 try{
  if(req.method==="GET"&&(u.pathname==="/"||u.pathname==="/notes"||u.pathname==="/notes/")){const page=await fetch("https://raw.githubusercontent.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/main/notes/index.html",{cf:{cacheTtl:0}});if(!page.ok)return new Response("CEO Notes page unavailable",{status:502});let html=await page.text();html=html.replace("https://royalegyptgroup.pages.dev/notes/","https://ceo-notes-ai.yasser-abdelaziz83.workers.dev/notes");return new Response(html,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});}if(req.method==="GET"&&u.pathname==="/notes/posts.json")return J(await getFeed(env),200,true);if(req.method==="GET"&&u.pathname==="/feed")return J(await getFeed(env),200,true);
  if(req.method==="GET"&&u.pathname.startsWith("/image/")){
   const day=Number(u.pathname.split("/").pop()),b64=await env.CEO_NOTES_KV.get("image:"+day);
   if(!b64)return J({error:"image_not_found"},404);
   const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
   return new Response(bin,{headers:{"content-type":"image/jpeg","cache-control":"public, max-age=31536000","Access-Control-Allow-Origin":"*"}});
  }
  if(req.method==="POST"&&u.pathname===GEN_PATH){
   const feed=await getFeed(env),posts=Array.isArray(feed.posts)?feed.posts:[];
   const day=Math.max(26,...posts.map(p=>Number(p.day)||0))+(posts.some(p=>Number(p.day)>=26)?1:0);
   const recent=posts.slice(-12).map(p=>({day:p.day,title:p.title,idea:p.ideaOfTheDay}));
   const prompt=`اكتب منشور CEO NOTES رقم ${day} باللهجة المصرية المهنية، بنفس روح السلسلة: عنوان قوي، افتتاحية ذكية، فقرات تحليلية متصلة، رسالة إدارية عملية، ثم فكرة اليوم والتحدي وسؤال النقاش.
الموضوع جديد وغير مكرر عن هذه العناوين والأفكار الأخيرة: ${JSON.stringify(recent)}.
نوّع بين القيادة، التفويض، الثقة، التواصل، التركيز، إدارة الخلاف، التعلم، واتخاذ القرار. المقال 160-200 كلمة في 4 فقرات فعلية، باللهجة المصرية الطبيعية المحترمة، لا تبدأ بعبارة "زملائي الأعزاء"، ولا تستخدم فصحى جامدة أو شعارات عامة. لا تخترع أسماء أشخاص أو وقائع محددة؛ استخدم مواقف عمل عامة واقعية.
أعد JSON فقط بالمفاتيح day,title,article,ideaOfTheDay,ceoChallenge,discussionQuestion,hashtags,imagePrompt.
فكرة اليوم جملة قصيرة قوية. التحدي تمرين محدد خلال 48 ساعة. سؤال النقاش مفتوح وغير سطحي. الهاشتاجات نص واحد مفصول بمسافات ويشمل #CEO_Notes #CEO_Challenge #فكرة_اليوم #إدارة #قيادة ووسمين مناسبين.
imagePrompt باللغة الإنجليزية، صورة تحريرية فوتوغرافية سينمائية portrait مرتبطة مباشرة بموضوع المقال، مشهد CEO واقعي، ألوان أسود وذهبي، إضاءة راقية، بلا كتابة أو شعارات أو علامات مائية.`;
   const ai=await env.AI.run("@cf/aisingapore/gemma-sea-lion-v4-27b-it",{messages:[{role:"system",content:"You are the chief editor of CEO Notes. Write authentic Egyptian Arabic. Return only valid JSON."},{role:"user",content:prompt}],max_tokens:1200,temperature:0.72});
   const post=parse(ai.response||ai.choices?.[0]?.message?.content);post.day=day;if(Array.isArray(post.hashtags))post.hashtags=post.hashtags.join(" ");
   if(day===26){
    post.title="لما التفويض مش ضعف.. ده استثمار";
    post.article="كتير من المديرين بيشوفوا التفويض كأنه خروج من المسؤولية، أو دليل إنهم مش قادرين يمسكوا كل التفاصيل. لكن التفويض الذكي مش إنك ترمي المهمة على حد وتمشي؛ هو إنك تبني شخص يقدر يشيل مسؤولية، وتديله فرصة يتعلم ويكبر.\n\nلما المدير يصر يعمل كل حاجة بنفسه، وقته بيتسحب في تفاصيل يومية، ومبيلاقيش مساحة يركز على القرارات اللي بتحرك الشغل لقدام. وفي نفس الوقت، الفريق بيتعود يستنى التعليمات بدل ما يفكر ويقترح. المشكلة مش بالضرورة في قدرات الناس؛ ساعات المشكلة في مساحة الثقة والصلاحية اللي بنديهالهم.\n\nالتفويض الصح يبدأ باختيار الشخص المناسب، وتوضيح النتيجة المطلوبة وحدود الصلاحية، وتوفير المعلومات والأدوات. بعد كده دورك يبقى متابعة وتوجيه، مش تدخل في كل خطوة. ولو حصل خطأ، ناقشه باعتباره فرصة تعلم، مش سبب تسحب المهمة فورًا.\n\nالقائد اللي بيعمل كل حاجة بنفسه ممكن يبان مشغول طول الوقت، لكنه بيصنع نقطة اختناق حوالين نفسه. أما اللي بيفوض بوعي، فهو بيضاعف قدرة الفريق وبيجهز ناس تقدر تتحمل مسؤولية أكبر.";
    post.ideaOfTheDay="التفويض تمكين.. مش تخليص.";
    post.ceoChallenge="خلال الـ48 ساعة الجاية، اختار مهمة روتينية بتعملها بنفسك، وفوضها لشخص في فريقك. وضّح النتيجة والصلاحيات، وقدّم الدعم من غير ما تسحب منه المسؤولية.";
    post.discussionQuestion="إيه أكتر حاجة بتصعّب عليك تفويض المهام: الخوف من الخطأ، ضعف الثقة، ولا عدم وضوح الصلاحيات؟";
    post.hashtags="#CEO_Notes #CEO_Challenge #فكرة_اليوم #إدارة #قيادة #تمكين_الفريق";
    post.imagePrompt="Cinematic editorial photograph of a senior executive in a refined modern office confidently handing a project folder to a capable colleague, symbolizing trust, delegation and team empowerment. Anonymous people, natural candid moment, sophisticated black and warm gold palette, realistic corporate photography, elegant lighting, portrait composition, no text, no logos, no watermark.";
   }
   if(!post.title||!post.article||String(post.article).length<500||!post.imagePrompt)return J({error:"quality_check_failed",length:String(post.article||"").length,post},502);
   return J({post,imagePrompt:post.imagePrompt,usage:{textNeurons:ai.usage?.neurons}});
  }
  if(req.method==="GET"&&u.pathname===IMAGE_PATH){
   const day=Number(u.searchParams.get("day")),post={day,title:u.searchParams.get("title")||"",article:u.searchParams.get("article")||"",ideaOfTheDay:u.searchParams.get("ideaOfTheDay")||"",ceoChallenge:u.searchParams.get("ceoChallenge")||"",discussionQuestion:u.searchParams.get("discussionQuestion")||"",hashtags:u.searchParams.get("hashtags")||""};
   const prompt=u.searchParams.get("imagePrompt")||"Cinematic editorial portrait, modern executive office, black and warm gold palette, no text or logos.";
   if(!Number.isInteger(day)||day<26||!post.title||!post.article)return J({error:"missing_post_fields"},400);
   const image=await env.AI.run("@cf/black-forest-labs/flux-1-schnell",{prompt:prompt.slice(0,2048),steps:4});
   if(!image.image)return J({error:"image_generation_failed"},502);
   await env.CEO_NOTES_KV.put("image:"+day,image.image);
   const imageUrl=PUBLIC_BASE+"/image/"+day,published={...post,status:"Published",publishedAt:new Date().toISOString(),imageUrl};
   return J({post:published,imageUrl,usage:{imageNeurons:image.usage?.neurons}});
  }
  if((req.method==="POST"||req.method==="GET")&&u.pathname===PUBLISH_PATH){
   let post;
   if(req.method==="GET"){
    const q=u.searchParams;
    post={day:Number(q.get("day")),title:q.get("title")||"",article:q.get("article")||"",ideaOfTheDay:q.get("ideaOfTheDay")||"",ceoChallenge:q.get("ceoChallenge")||"",discussionQuestion:q.get("discussionQuestion")||"",hashtags:q.get("hashtags")||"",publishedAt:q.get("publishedAt")||""};
   }else{
    const ct=req.headers.get("content-type")||"";
    if(ct.includes("multipart/form-data")){const f=await req.formData();post=JSON.parse(String(f.get("post")||"{}"));}
    else {
     const body=await req.json();
     if(body?.receiptOnly===true){
      const day=Number(body.day),ceoPostId=String(body.ceoPostId||""),royalPostId=String(body.royalPostId||""),ceoPageId=String(body.ceoPageId||""),royalPageId=String(body.royalPageId||"");
      if(!Number.isInteger(day)||!ceoPostId||!royalPostId||!ceoPageId||!royalPageId)return J({error:"invalid_receipt_payload"},400);
      const feed=await getFeed(env),posts=Array.isArray(feed.posts)?feed.posts:[],index=posts.findIndex(p=>Number(p.day)===day&&p.status==="Published");
      if(index<0)return J({error:"published_post_not_found"},404);
      const now=new Date().toISOString(),previous=posts[index].publishingReceipts||{};
      const publishingReceipts={...previous,ceoNotes:{...(previous.ceoNotes||{}),pageId:ceoPageId,postId:ceoPostId,recordedAt:now},royalEgyptProperties:{...(previous.royalEgyptProperties||{}),pageId:royalPageId,postId:royalPostId,recordedAt:now}};
      const next={...feed,posts:posts.map((p,i)=>i===index?{...p,publishingReceipts}:p)};
      await env.CEO_NOTES_KV.put("feed",JSON.stringify(next));
      return J({ok:true,receiptStored:true,day,receiptCount:2});
     }
     post=body.post||body;
    }
   }
   const day=Number(post.day),image=await env.CEO_NOTES_KV.get("image:"+day);
   if(!Number.isInteger(day)||day<26||!post.title||!post.article||!image)return J({error:"invalid_publish_payload_or_image_missing"},400);
   const feed=await getFeed(env),posts=Array.isArray(feed.posts)?feed.posts:[];
   const exists=posts.find(p=>Number(p.day)===day&&p.status==="Published");
   if(exists)return J({ok:true,alreadyPublished:true,day,post:exists});
   const published={...post,day,status:"Published",imageUrl:PUBLIC_BASE+"/image/"+day,publishedAt:post.publishedAt||new Date().toISOString()};
   const next={version:1,posts:[...posts.filter(p=>Number(p.day)!==day),published].sort((a,b)=>Number(a.day)-Number(b.day))};
   await env.CEO_NOTES_KV.put("feed",JSON.stringify(next));
   return J({ok:true,day,posts:next.posts.length,imageUrl:published.imageUrl});
  }
  return J({error:"not_found"},404);
 }catch(e){return J({error:"generation_failed",detail:String(e?.message||e)},502);}
},async scheduled(event,env,ctx){ctx.waitUntil(createBackup(env,event.scheduledTime).catch(error=>console.error("backup_failed",String(error))));}};