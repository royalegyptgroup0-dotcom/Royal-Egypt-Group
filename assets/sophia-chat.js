(()=>{"use strict";
async function ask(messages){
 const response=await fetch("/api/assistant",{
  method:"POST",
  headers:{"content-type":"application/json"},
  body:JSON.stringify({messages:(Array.isArray(messages)?messages:[]).map(item=>({
   role:item?.role==="assistant"?"assistant":"user",
   content:typeof item?.text==="string"?item.text:""
  }))})
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(result.error||"assistant_unavailable");
 if(typeof result.answer!=="string"||!result.answer.trim())throw new Error("assistant_unavailable");
 return result.answer.trim();
}
window.RoyalSophia=Object.freeze({ask});
})();