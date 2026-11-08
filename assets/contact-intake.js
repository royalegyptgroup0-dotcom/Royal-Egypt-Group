(()=>{"use strict";
const form=document.getElementById("groupContactForm");
if(!form)return;
const status=document.getElementById("groupContactStatus");
const language=document.getElementById("contactLanguage");
const copy={
ar:{privacy:"نستخدم بياناتك للرد على طلبك فقط، ولا يتم نشر إعلان تلقائيًا.",languageLabel:"لغة التواصل",typeLabel:"نوع الطلب *",typeCustomer:"استفسار عام",typeOpportunity:"أبحث عن عقار",typeListing:"أرغب في عرض عقار",nameLabel:"الاسم *",phoneLabel:"الهاتف / واتساب *",emailLabel:"البريد الإلكتروني (اختياري)",locationLabel:"المنطقة أو المدينة (اختياري)",detailsLabel:"تفاصيل الطلب *",consent:"أوافق على استخدام بياناتي للرد على هذا الطلب والتواصل معي بشأنه.",submit:"إرسال الطلب",sending:"جارٍ إرسال الطلب...",success:"تم استلام طلبك. رقم المتابعة: ",failure:"تعذر إرسال الطلب الآن. حاول مرة أخرى أو تواصل معنا عبر واتساب."},
en:{privacy:"Your details are used only to respond to this request. No listing is published automatically.",languageLabel:"Contact language",typeLabel:"Request type *",typeCustomer:"General enquiry",typeOpportunity:"I'm looking for a property",typeListing:"I want to list a property",nameLabel:"Name *",phoneLabel:"Phone / WhatsApp *",emailLabel:"Email (optional)",locationLabel:"Area or city (optional)",detailsLabel:"Request details *",consent:"I agree to have my details used to respond to this request and contact me about it.",submit:"Send request",sending:"Sending your request...",success:"Your request was received. Reference: ",failure:"We couldn't send your request. Please try again or contact us on WhatsApp."},
ru:{privacy:"Ваши данные используются только для ответа на запрос. Объявление не публикуется автоматически.",languageLabel:"Язык общения",typeLabel:"Тип запроса *",typeCustomer:"Общий вопрос",typeOpportunity:"Ищу недвижимость",typeListing:"Хочу разместить объект",nameLabel:"Имя *",phoneLabel:"Телефон / WhatsApp *",emailLabel:"Электронная почта (необязательно)",locationLabel:"Район или город (необязательно)",detailsLabel:"Подробности запроса *",consent:"Я согласен(на) использовать мои данные для ответа на запрос и связи со мной по этому вопросу.",submit:"Отправить запрос",sending:"Отправка запроса...",success:"Запрос получен. Номер: ",failure:"Не удалось отправить запрос. Попробуйте позже или свяжитесь с нами через WhatsApp."}
};
const t=key=>(copy[language.value]||copy.ar)[key]||copy.ar[key]||key;
function applyLanguage(){document.querySelectorAll("[data-contact-i18n]").forEach(node=>{node.textContent=t(node.dataset.contactI18n);});}
language.addEventListener("change",applyLanguage);
let requestId=null;
form.addEventListener("submit",async event=>{
 event.preventDefault();
 if(!form.reportValidity())return;
 const values=new FormData(form);
 const payload={
  request_id:requestId||(requestId=crypto.randomUUID()),
  name:String(values.get("name")||"").trim(),
  phone:String(values.get("phone")||"").trim(),
  email:String(values.get("email")||"").trim(),
  request_type:String(values.get("request_type")||""),
  location:String(values.get("location")||"").trim(),
  details:String(values.get("details")||"").trim(),
  language:String(values.get("language")||"ar"),
  consent:values.get("consent")==="yes",
  website:String(values.get("website")||"")
 };
 const button=form.querySelector('button[type="submit"]');
 button.disabled=true;
 status.textContent=t("sending");
 try{
  const response=await fetch("/api/intake",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.error||"request_failed");
  form.reset();
  requestId=null;
  status.textContent=t("success")+(result.reference||"");
  applyLanguage();
 }catch(error){
  status.textContent=t("failure");
 }finally{button.disabled=false;}
});
applyLanguage();
})();