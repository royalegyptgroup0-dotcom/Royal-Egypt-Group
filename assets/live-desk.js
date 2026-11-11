(()=>{"use strict";
const $=(id)=>document.getElementById(id);
const fmt=(v)=>new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(v);
const ratesNote=$("liveFxNote");
async function loadRates(){
 const fields={USD:$("liveUsdEgp"),EUR:$("liveEurEgp"),GBP:$("liveGbpEgp"),SAR:$("liveSarEgp"),AED:$("liveAedEgp")};
 try{
  const response=await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EGP,EUR,GBP",{headers:{Accept:"application/json"},cache:"no-store"});
  if(!response.ok)throw new Error("FX source unavailable");
  const data=await response.json(),usd=data.rates?.EGP,eur=data.rates?.EUR,gbp=data.rates?.GBP;
  if(!usd||!eur||!gbp)throw new Error("Incomplete FX response");
  const values={USD:usd,EUR:usd/eur,GBP:usd/gbp};
  // Frankfurter does not publish EGP crosses for SAR/AED; derive via USD pegs only as indicative estimates.
  values.SAR=usd/3.75; values.AED=usd/3.6725;
  for(const [key,el] of Object.entries(fields))if(el)el.textContent=fmt(values[key])+" EGP";
  if(ratesNote)ratesNote.textContent="مرجع يومي · "+(data.date||"تاريخ غير محدد")+" · SAR/AED تقدير محسوب من ربط العملتين بالدولار، وليس سعرًا مصرفيًا";
 }catch(e){for(const el of Object.values(fields))if(el)el.textContent="غير متاح";if(ratesNote)ratesNote.textContent="تعذر تحديث أسعار الصرف الآن؛ لم نعرض أسعارًا قديمة."}
}
const clockDefs=[["Cairo","القاهرة","Africa/Cairo"],["Dubai","دبي","Asia/Dubai"],["Riyadh","الرياض","Asia/Riyadh"],["London","لندن","Europe/London"],["NewYork","نيويورك","America/New_York"],["Moscow","موسكو","Europe/Moscow"]];
function tickClocks(){const now=new Date();for(const [id,label,zone] of clockDefs){const el=$("world"+id);if(el)el.textContent=new Intl.DateTimeFormat("en-GB",{timeZone:zone,hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(now)}}
tickClocks();setInterval(tickClocks,1000);loadRates();setInterval(loadRates,30*60*1000);
const list=$("radioStations"),audio=$("radioAudio"),status=$("radioStatus"),refresh=$("radioRefresh");
async function loadStations(){
 if(!list||!audio)return;
 if(status)status.textContent="جارٍ تحميل المحطات المتاحة…";
 try{
  const response=await fetch("https://de1.api.radio-browser.info/json/stations/search?countrycode=EG&hidebroken=true&order=clickcount&reverse=true&limit=20",{headers:{Accept:"application/json"}});
  if(!response.ok)throw new Error("Radio directory unavailable");
  const stations=await response.json();
  const valid=stations.filter(s=>s.url_resolved&&s.name).slice(0,15);
  list.replaceChildren();
  for(const station of valid){const option=document.createElement("option");option.value=station.url_resolved;option.textContent=station.name+(station.codec?" · "+station.codec:"");option.dataset.station=station.name;list.append(option)}
  if(!valid.length)throw new Error("No working stations returned");
  if(status)status.textContent="تم تحميل "+valid.length+" محطة مصرية. اختر محطة واضغط تشغيل.";
 }catch(e){if(status)status.textContent="تعذر تحميل دليل الراديو الآن. جرّب التحديث لاحقًا."}
}
if(list&&audio){list.addEventListener("change",()=>{const opt=list.selectedOptions[0];if(!opt)return;audio.src=opt.value;if(status)status.textContent="المحطة المختارة: "+(opt.dataset.station||opt.textContent)+" · اضغط تشغيل.";});audio.addEventListener("error",()=>{if(status)status.textContent="تعذر تشغيل هذه المحطة؛ جرّب محطة أخرى."});}
if(refresh)refresh.addEventListener("click",loadStations);loadStations();
const notes=$("ceoNotesFeed"),notesStatus=$("ceoNotesStatus");
async function loadNotes(){
 if(!notes)return;
 try{
  const response=await fetch("/notes/posts.json",{headers:{Accept:"application/json"},cache:"no-store"});
  if(!response.ok)throw new Error("CEO Notes feed unavailable");
  const data=await response.json();
  const posts=(Array.isArray(data.posts)?data.posts:[]).filter(p=>String(p.status||"").toLowerCase()==="published").sort((a,b)=>(Number(b.day)||0)-(Number(a.day)||0)).slice(0,3);
  notes.replaceChildren();
  for(const post of posts){
   const article=document.createElement("article");article.className="ceo-note-card";
   const meta=document.createElement("span");meta.className="ceo-note-day";meta.textContent="CEO NOTES · DAY "+(post.day??"");
   const title=document.createElement("h3");title.textContent=post.title||"مقال جديد";
   const excerpt=document.createElement("p");excerpt.textContent=(post.article||"").slice(0,230)+(String(post.article||"").length>230?"…":"");
   const link=document.createElement("a");link.href="https://ceo-notes.pages.dev/";link.target="_blank";link.rel="noopener noreferrer";link.textContent="اقرأ المزيد على CEO Notes ↗";
   article.append(meta,title,excerpt,link);notes.append(article);
  }
  if(notesStatus)notesStatus.textContent=posts.length?"آخر المقالات المنشورة من موجز CEO Notes.":"لا توجد مقالات منشورة في الموجز حاليًا.";
 }catch(e){if(notesStatus)notesStatus.textContent="تعذر تحميل موجز CEO Notes حاليًا. يمكنك زيارة الموقع مباشرة."}
}
loadNotes();
})();