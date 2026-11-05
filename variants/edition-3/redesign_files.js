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
function flDel(key){if(!IDBH||!IDBH.objectStoreNames.contains('fl'))return;try{IDBH.transaction('fl','readwrite').objectStore('fl').delete(key)}catch(e){}}
/* ---------- nothing is ever deleted: the only way to take something out of sight is to archive it ---------- */
const ACT_AR={
  restorepk:el=>{const a=(S.archPk||[]).find(x=>x.p.id===el.dataset.id);if(!a)return;const have={};S.orders.forEach(o=>have[o.ref]=1);
    const back=a.orders.filter(o=>!have[o.ref]),skip=a.orders.length-back.length;S.pickups.push(a.p);back.forEach(o=>S.orders.push(o));S.archPk=S.archPk.filter(x=>x!==a);audit('استرجاع بيك أب: '+a.p.label);dirty();toast('اتسترجع '+a.p.label+' ('+back.length+' أوردر)'+(skip?'. '+skip+' أوردر موجودين بالفعل فمتكرروش':''));render()},
  restoredoc:el=>{const a=(S.archDocs||[]).find(x=>x.d.id===el.dataset.id);if(!a)return;S.docs.push(a.d);S.archDocs=S.archDocs.filter(x=>x!==a);audit('استرجاع مسودة');dirty();toast('اتسترجعت المسودة');render()},
  demoreset:()=>{let p=null;try{p=localStorage.getItem(KEY+'-pre-demo')}catch(e){}
    if(p){try{S=JSON.parse(p);ensureSup(S);ensureCat(S);rebuildCatalog();S.date=cairoToday();_bal=null;_ctx=null;UI.doc=null;UI.sheet=null;UI.demoAsk=false;save();UI.tab='today';toast('رجعت البيانات اللي كانت قبل الداتا التجريبية');render();return}catch(e){}}
    ACT.reset2();UI.tab='today';render()}
};
function arPage(){
  const pk=(S.archPk||[]).slice().reverse(),dc=(S.archDocs||[]).slice().reverse();
  let h='<div class="msg" style="margin-bottom:14px">مفيش حاجة بتتمسح من السيستم. اللي بتأرشفه بيتشال من الشاشات لكنه محفوظ هنا وتقدر ترجّعه في أي وقت.</div>';
  h+='<div class="gh">بيك أب مؤرشف</div>'+(pk.length?'<div class="tw"><table class="t-sm"><thead><tr><th>البيك أب</th><th>التاريخ</th><th class="num">أوردرات</th><th>اتأرشف</th><th></th></tr></thead><tbody>'+pk.map(a=>'<tr><td><b>'+esc(a.p.label)+'</b></td><td class="mono">'+esc(a.p.date)+'</td><td class="num">'+fmt(a.orders.length)+'</td><td class="muted">'+esc((a.by||'')+(a.at?' · '+timeOf(a.at):''))+'</td><td class="num"><button class="btn sm" data-a="restorepk" data-id="'+a.p.id+'">استرجاع</button></td></tr>').join('')+'</tbody></table></div>':'<div class="card"><div class="empty">مفيش بيك أب مؤرشف.</div></div>');
  h+='<div class="gh" style="margin-top:18px">مسودات مؤرشفة</div>'+(dc.length?'<div class="tw"><table class="t-sm"><thead><tr><th>النوع</th><th>التاريخ</th><th class="num">بنود</th><th>اتأرشف</th><th></th></tr></thead><tbody>'+dc.map(a=>'<tr><td><b>'+esc((OT[a.d.type]||{}).ar||a.d.type)+'</b></td><td class="mono">'+esc(a.d.date||'')+'</td><td class="num">'+fmt((a.d.lines||[]).length)+'</td><td class="muted">'+esc((a.by||'')+(a.at?' · '+timeOf(a.at):''))+'</td><td class="num"><button class="btn sm" data-a="restoredoc" data-id="'+a.d.id+'">استرجاع</button></td></tr>').join('')+'</tbody></table></div>':'<div class="card"><div class="empty">مفيش مسودات مؤرشفة.</div></div>');
  return h;
}
