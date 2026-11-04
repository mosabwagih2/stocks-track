/* ---------- originals: every uploaded file is kept as-is (IndexedDB 'fl') and can be downloaded any time ---------- */
function flPut(key,blob){if(!blob||!IDBH||!IDBH.objectStoreNames.contains('fl'))return;try{IDBH.transaction('fl','readwrite').objectStore('fl').put({blob,name:blob.name||'',type:blob.type||'',size:blob.size,at:Date.now()},key)}catch(e){}}
function flGet(key){return new Promise(res=>{if(!IDBH||!IDBH.objectStoreNames.contains('fl'))return res(null);try{const rq=IDBH.transaction('fl').objectStore('fl').get(key);rq.onsuccess=()=>res(rq.result||null);rq.onerror=()=>res(null)}catch(e){res(null)}})}
function dataBlob(u){try{const m=/^data:([^;,]*)(;base64)?,(.*)$/.exec(u);if(!m)return null;const bin=m[2]?atob(m[3]):decodeURIComponent(m[3]),a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return new Blob([a],{type:m[1]||'application/octet-stream'})}catch(e){return null}}
function flSize(n){return n>1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB'}
async function flDL(key,label){
  const r=await flGet(key);
  if(r&&r.blob){saveFile(r.name||label||'file',r.blob,'اتنزّل الملف الأصلي');return}
  const u=key.indexOf('ph:')===0?PH[key.slice(3)]:key.indexOf('cx:')===0?PH[cxKey(key.slice(3))]:null;
  if(u){const b=dataBlob(u);if(b){saveFile(((label||'photo').replace(/\.[^.]+$/,''))+'.jpg',b,'اتنزّلت الصورة');return}}
  toast('الملف الأصلي مش محفوظ في المتصفح ده');
}
function flBtn(key,meta,txt){return meta?'<button class="btn sm" data-a="fldl" data-k="'+esc(key)+'" data-n="'+esc(meta.name||'')+'">⬇ '+(txt||'تنزيل الملف الأصلي')+' <span class="muted" style="font-size:11px">'+esc(meta.name||'')+(meta.size?' · '+flSize(meta.size):'')+'</span></button>':''}
const ACT_FL={fldl:el=>{flDL(el.dataset.k,el.dataset.n)}};
