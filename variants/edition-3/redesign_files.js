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
  suparchgo:()=>{go('ledger',()=>{UI.led.tab='arch'})},
  restorepk:el=>{const a=(S.archPk||[]).find(x=>x.p.id===el.dataset.id);if(!a)return;const have={};S.orders.forEach(o=>have[o.ref]=1);
    const back=a.orders.filter(o=>!have[o.ref]),skip=a.orders.length-back.length;S.pickups.push(a.p);back.forEach(o=>S.orders.push(o));S.archPk=S.archPk.filter(x=>x!==a);audit('استرجاع بيك أب: '+a.p.label);dirty();toast('اتسترجع '+a.p.label+' ('+back.length+' أوردر)'+(skip?'. '+skip+' أوردر موجودين بالفعل فمتكرروش':''));render()},
  restoredoc:el=>{const a=(S.archDocs||[]).find(x=>x.d.id===el.dataset.id);if(!a)return;S.docs.push(a.d);S.archDocs=S.archDocs.filter(x=>x!==a);audit('استرجاع مسودة');dirty();toast('اتسترجعت المسودة');render()},
  demoreset:()=>{let p=null;try{p=localStorage.getItem(KEY+'-pre-demo')}catch(e){}
    if(p){try{S=JSON.parse(p);ensureSup(S);ensureCat(S);rebuildCatalog();S.date=cairoToday();_bal=null;_ctx=null;UI.doc=null;UI.sheet=null;UI.demoAsk=false;save();UI.tab='today';toast('رجعت البيانات اللي كانت قبل الداتا التجريبية');render();return}catch(e){}}
    ACT.reset2();UI.tab='today';render()}
};
/* every archived thing, from every part of the system, in one list with where it came from */
function arItems(){
  const a=[];
  (S.archPk||[]).forEach(x=>a.push({k:'pk',id:x.p.id,src:'البيك أب',tone:'info',name:x.p.label,sub:fmt(x.orders.length)+' أوردر · '+(x.p.date||''),by:x.by,at:x.at}));
  (S.archDocs||[]).forEach(x=>a.push({k:'doc',id:x.d.id,src:'العمليات (مسودة)',tone:'warn',name:(OT[x.d.type]||{}).ar||x.d.type,sub:(x.d.date||'')+' · '+fmt((x.d.lines||[]).length)+' بند',by:x.by,at:x.at}));
  (S.sup&&S.sup.items||[]).filter(i=>i.arch).forEach(i=>a.push({k:'sup',id:i.id,src:'المستلزمات',tone:'good',name:i.name,sub:'الرصيد '+fmt(supBal(i.id))+' '+(i.unit||'')}));
  const bm={};Object.keys((S.cat&&S.cat.arch)||{}).forEach(id=>{if(S.cat.arch[id]&&SKU.has(id)){const m=SKU.get(id).m;(bm[m]||(bm[m]=[])).push(id)}});
  Object.keys(bm).forEach(m=>a.push({k:'model',id:m,src:'المخزون (موديل)',tone:'lost',name:mName(m),sub:fmt(bm[m].length)+' صنف (لون × مقاس)'}));
  (S.users||[]).filter(u=>u.arch).forEach(u=>a.push({k:'user',id:u.id,src:'المستخدمين',tone:'',name:u.name,sub:roleName(u.role)}));
  return a;
}
const arKey=x=>x.k+':'+x.id;
function arPage(){
  const it=arItems(),ask=UI.arAsk;
  let h='<div class="msg" style="margin:0 0 14px">مفيش حاجة بتتمسح من السيستم. أي حاجة بتأرشفها من أي صفحة بتتجمع هنا، ومكتوب جنبها جاية منين. تقدر ترجّعها في أي وقت.</div>';
  if(!it.length)return h+'<div class="card"><div class="empty">مفيش حاجة مؤرشفة.</div></div>';
  const kinds=[...new Set(it.map(x=>x.src))];
  h+='<div class="tw"><table class="t-sm"><thead><tr><th>جاية منين</th><th>الاسم</th><th>تفاصيل</th><th>اتأرشف</th><th></th></tr></thead><tbody>'+it.map(x=>{
    const key=arKey(x),asking=ask===key;
    return '<tr><td><span class="pill '+x.tone+'">'+esc(x.src)+'</span></td><td><b>'+esc(x.name)+'</b></td><td class="muted">'+esc(x.sub||'')+'</td><td class="muted">'+esc((x.by||'')+(x.at?' · '+timeOf(x.at):''))+'</td><td class="num" style="white-space:nowrap">'+(asking?'<span class="muted" style="font-size:12px">متأكد؟</span> <button class="btn sm pri" data-a="aryes">أيوه، رجّعه</button> <button class="btn sm" data-a="arno">لأ</button>':'<button class="btn sm" data-a="arask" data-k="'+esc(key)+'">استرجاع</button>')+'</td></tr>'}).join('')+'</tbody></table></div>';
  return h;
}
Object.assign(ACT_AR,{
  arask:el=>{UI.arAsk=el.dataset.k;render()},
  arno:()=>{UI.arAsk=null;render()},
  aryes:()=>{const k=String(UI.arAsk||''),i=k.indexOf(':'),kind=k.slice(0,i),id=k.slice(i+1);UI.arAsk=null;
    if(kind==='pk')ACT_AR.restorepk({dataset:{id}});
    else if(kind==='doc')ACT_AR.restoredoc({dataset:{id}});
    else if(kind==='sup'){UI.supAsk=id;ACT.suprestoreyes()}
    else if(kind==='model')ACT.modelrestore({dataset:{m:id}});
    else if(kind==='user')ACT.usrestore({dataset:{id}});
    render()}
});
/* ---------- colours: a real swatch for every colour, picked by the user or guessed from the name ---------- */
const GUESS_HEX=[[/خضر|اخضر|فستقي|نعناع/,'#3f9b4b'],[/زيتون|زيتي|زيتى/,'#6f7a3c'],[/ازرق|زرق/,'#2f6fd1'],[/سماوي|لبني|تركوا/,'#6cc3e0'],[/بنفسج|موف|ليلك|لافندر/,'#8a5bd0'],[/بني|قهو|شيكولات|شوكولات/,'#6b4423'],[/ذهب/,'#d4a72c'],[/فضي/,'#c0c0c8'],[/عنابي|نبيتي|بوردو|خمر/,'#7a1f3d'],[/وردي|بينك/,'#f08bb0'],[/خردل/,'#c9a227'],[/كاكي/,'#a39b6b'],[/كريم|عاج|اوف|اوف وايت/,'#f3ecd9'],[/رصاص|جراي|رمادي/,'#8c8c94'],[/بترول/,'#1f5f6b'],[/نيلي/,'#2a3a8c'],[/طوب/,'#b4552d'],[/اسود|أسود/,'#1e1b24'],[/ابيض|أبيض/,'#ffffff'],[/احمر|أحمر/,'#d9262e'],[/اصفر|أصفر/,'#f2c230'],[/برتقال/,'#f07a2b'],[/بيج/,'#ead9be'],[/كحلي/,'#1f2a5a']];
function guessHex(n){const s=String(n||'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/^ال/,'').trim();if(!s)return '';for(const [re,h] of GUESS_HEX)if(re.test(s))return h;return ''}
function colHex(c){return (S&&S.cat&&S.cat.hex&&S.cat.hex[c])||HEX[c]||guessHex(c)||'#cfc2ec'}
function hexSave(v,h){if(HEX[v])return;const x=h||guessHex(v);if(!x)return;(S.cat.hex||(S.cat.hex={}))[v]=x;dirty()}
function hexWrap(){
  const live=el=>{const s=UI.sheet;if(!s)return;const f=el.dataset.f;
    if(f==='newHex'){s.hexTouched=true;return}
    if(f==='newColor'||f==='newC'){if(!s.hexTouched){const h=guessHex(el.value)||'#8a8a8a',p=document.getElementById('nhx');s.newHex=h;if(p)p.value=h}}};
  const ps=INP.skuf,pc=INP.catf;
  INP.skuf=el=>{if(ps)ps(el);else{const s=UI.sheet;if(s)s[el.dataset.f]=el.value}live(el)};
  INP.catf=el=>{pc(el);live(el)};
  const cs=CHG.skuf,cc=CHG.catf;
  CHG.skuf=el=>{cs(el);live(el)};CHG.catf=el=>{cc(el);live(el)};
}
/* ---------- Today: one event, everything about it, in a pop-up ---------- */
function tevSheet(s){
  const e=ledgerEvents().find(x=>x.key===s.k);
  if(!e)return {title:'العملية',body:'<div class="empty">مش لاقي تفاصيل العملية دي.</div>'};
  const head='<div class="card flat" style="margin:0 0 12px"><div class="row sp" style="gap:10px"><span><b style="font-size:16px">'+e.title+'</b><div class="muted" style="font-size:13px;margin-top:4px">'+(e.who?esc(e.who):'—')+(e.t>1e12?' · '+timeOf(e.t):'')+(e.no?' · <span class="mono">'+esc(e.no)+'</span>':'')+' · '+esc(e.date||'')+'</div></span>'+(e.pcs&&e.kind!=='sup'?'<span style="text-align:center"><b class="n" style="font-size:24px">'+fmt(e.pcs)+'</b><div class="muted" style="font-size:12px">قطعة</div></span>':'')+'</div></div>';
  return {title:e.type||'العملية',body:head+'<div class="lgd" style="border:0;padding:0">'+ledgerDetail(e)+'</div>'};
}
Object.assign(ACT_AR,{tev:el=>{UI.sheet={kind:'tev',k:el.dataset.k};render()}});
