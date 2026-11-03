
/* ---------- shell & render ---------- */
const NAV=[['today','النهارده'],['orders','الأوردرات'],['stock','المخزون'],['ops','العمليات'],['supplies','المستلزمات'],['insights','التحليلات'],['ledger','السجل'],['config','الإعدادات']];
const VIEWS={today:vToday,orders:vOrders,stock:vStock,ops:vOps,supplies:vSupplies,insights:vInsights,ledger:vLedger,config:vConfig};
let theme='system';
function applyTheme(){const r=document.documentElement;if(theme==='system')r.removeAttribute('data-theme');else r.setAttribute('data-theme',theme)}
function curDoc(){return S.docs.find(d=>d.id===UI.doc)}
function badges(){
  const C=ctx(),b={};
  const A=actions();b.today=A.filter(a=>a.sev==='crit').length||'';
  b.orders=Object.keys(C.blocked).length||'';
  b.stock=D.skus.filter(k=>g(k.id,'READY')<0).length||'';
  b.ops=S.docs.filter(d=>d.status==='draft').length||'';
  return b;
}
function render(){
  const b=badges();
  const rail='<nav class="rail" aria-label="التنقل"><div class="brand"><i>F</i><div><b>Fémini</b><small>Stock · مخزن</small></div></div>'+NAV.map(n=>'<button class="nav" data-a="go" data-t="'+n[0]+'" '+(UI.tab===n[0]?'aria-current="page"':'')+'>'+ic(n[0])+'<span>'+n[1]+'</span>'+(b[n[0]]?'<span class="bd">'+b[n[0]]+'</span>':'')+'</button>').join('')+'<div class="sp"></div><div class="foot"><button class="tbtn" data-a="theme">◐ المظهر: '+({system:'تلقائي',light:'فاتح',dark:'داكن'})[theme]+'</button><span>'+esc(S.actor)+' · نسخة تجريبية</span></div></nav>';
  $('#app').innerHTML='<div class="shell">'+rail+'<main class="main" id="main">'+(VIEWS[UI.tab]||vToday)()+'</main></div>'+sheetHTML();
  document.title='Fémini Stock';
}
function partial(){
  const d=curDoc();if(!d||UI.tab!=='ops'){render();return}
  const t=document.createElement('div');t.innerHTML=vDoc(d);
  const ns=t.querySelector('.sum'),os=$('.sum');if(ns&&os&&os.innerHTML!==ns.innerHTML)os.innerHTML=ns.innerHTML;
  $$('[data-sync]',t).forEach(n=>{const o=$('[data-sync="'+n.dataset.sync+'"]');if(o&&o.innerHTML!==n.innerHTML)o.innerHTML=n.innerHTML});
}
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;t.setAttribute('role','status');document.body.appendChild(t);setTimeout(()=>t.remove(),3200)}
function go(tab,fn){UI.sheet=null;if(tab!=='ops'||fn)UI.doc=null;if(fn)fn();UI.tab=tab;render();if(location.hash.slice(1)!==tab)location.hash=tab;window.scrollTo(0,0)}
function copy(text,ok){
  const fb=()=>{const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');toast(ok)}catch(e){toast('انسخ يدويًا')}ta.remove()};
  try{navigator.clipboard.writeText(text).then(()=>toast(ok),fb)}catch(e){fb()}
}

/* ---------- file handling ---------- */
function handleFile(file){
  const s=UI.sheet;if(!s||s.kind!=='upload'){UI.sheet=s={kind:'upload',t:'pickup',channel:'VENDOOR',date:S.date,emp:S.emps[S.emps.length-1]||'',res:null,err:''}}
  const isCsv=/\.csv$/i.test(file.name);
  if(!window.XLSX&&!(s.t==='scan'&&isCsv)){s.err='مكتبة قراءة Excel ما اتحملتش. اتأكد من الاتصال وجرّب تاني، أو ارفع ملف CSV للسكان.';render();return}
  const fr=new FileReader();
  fr.onload=()=>{
    try{
      s.fname=file.name;s.err='';
      if(s.t==='scan'){
        let rows;if(isCsv)rows=parseCSVText(new TextDecoder('utf-8').decode(fr.result));else{const wb=XLSX.read(fr.result,{type:'array'});rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''})}
        const sc=parseScan(rows),nm=sc.filter(x=>x.name)[0];if(!s.emp&&nm)s.emp=nm.name;s.res=matchScans(sc);
      }else{
        const wb=XLSX.read(fr.result,{type:'array'});s.rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});s.res=importRows(s.rows,s.channel,'__new__');
      }
    }catch(e){s.res=null;s.err=String(e.message||e)}
    render();
  };
  fr.onerror=()=>{s.err='مقدرتش أقرأ الملف';render()};
  fr.readAsArrayBuffer(file);
}

/* ---------- actions ---------- */
const ACT={
  go:el=>go(el.dataset.t),
  act:el=>{const a=actions()[+el.dataset.i];if(a)go(a.go[0],a.go[1])},
  theme:()=>{theme=theme==='system'?'dark':theme==='dark'?'light':'system';try{localStorage.setItem(KEY+'-theme',theme)}catch(e){}applyTheme();render()},
  upload:el=>{UI.sheet={kind:'upload',t:el.dataset.t,channel:'VENDOOR',date:S.date,emp:S.emps[S.emps.length-1]||'',res:null,err:''};render()},
  uptype:el=>{const s=UI.sheet;s.t=el.dataset.v;s.res=null;s.err='';s.fname='';s.manual=false;render()},
  pickfile:()=>$('#upfile').click(),
  closesheet:()=>{UI.sheet=null;render()},
  pksave:()=>{
    const s=UI.sheet,r=s.res;if(!r||!r.orders.length)return;
    const n=S.pickups.reduce((a,p)=>Math.max(a,+p.id.slice(1)||0),0)+1,id='P'+n;
    S.pickups.push({id,label:'بيك أب '+n,date:s.date,channel:s.channel,src:s.fname});
    r.orders.forEach(o=>{o.pk=id;S.orders.push(o)});S.date=s.date;dirty();
    UI.sheet=null;UI.o.pk=id;UI.o.f='all';toast('اتستورد '+r.orders.length+' أوردر. لسه ما اتخصمش حاجة.');go('orders');
  },
  scansave:()=>{
    const s=UI.sheet,r=s.res;if(!r||!r.matched.length||!(s.emp||'').trim())return;
    const d=makeScn(r.matched,s.emp.trim(),s.manual?'تسجيل يدوي':s.fname);d.date=S.date;
    if(!confirmDoc(d)){toast('مقدرتش أسجّل. راجع العملية');UI.sheet=null;go('ops',()=>{UI.doc=d.id});return}
    UI.sheet=null;UI.sel={};const neg=D.skus.filter(k=>g(k.id,'READY')<0).length;
    toast('اتسجّل '+r.matched.length+' أوردر وخرجوا من المخزون'+(neg?'. تنبيه: '+neg+' صنف بالسالب':''));go('orders',()=>{UI.o.f='done'});
  },
  gopk:el=>go('orders',()=>{UI.o.pk=el.dataset.id;UI.o.f='all';UI.o.tab='list';UI.o.n=60}),
  otab:el=>{UI.o.tab=el.dataset.v;render()},
  of:el=>{UI.o.f=el.dataset.v;UI.o.n=60;render()},
  omore:()=>{UI.o.n+=60;render()},
  order:el=>{UI.sheet={kind:'order',ref:el.dataset.ref};render()},
  sku:el=>{UI.sheet={kind:'sku',sku:el.dataset.sku};render()},
  selclear:()=>{UI.sel={};render()},
  manual:()=>{
    const refs=Object.keys(UI.sel).filter(k=>UI.sel[k]&&orderByRef(k)&&orderByRef(k).st==='open');
    UI.sheet={kind:'upload',t:'scan',manual:true,channel:'VENDOOR',date:S.date,emp:S.emps[S.emps.length-1]||'',err:'',
      res:{scans:refs.length,matched:refs.map(r=>({ref:r,t:''})),dups:[],already:[],unk:[],bad:refs.filter(r=>(orderByRef(r).bad||[]).length)}};
    render();
  },
  cxorder:el=>{const o=orderByRef(el.dataset.ref);if(o){o.st='cx';dirty();UI.sheet=null;toast('اتلغى الأوردر. مش هيتحسب كطلب.');render()}},
  uncx:el=>{const o=orderByRef(el.dataset.ref);if(o){o.st='open';dirty();UI.sheet=null;render()}},
  smodel:el=>{UI.s.m=el.dataset.m;render()},
  sstate:el=>{UI.s.state=el.dataset.v;render()},
  sview:el=>{UI.s.view=el.dataset.v;render()},
  ssort:el=>{UI.s.sort=el.dataset.v;render()},
  img:el=>{UI.sheet={kind:'img',m:el.dataset.m};render()},
  pickimg:el=>{UI.imgFor=el.dataset.m;$('#imgfile').click()},
  rmimg:el=>{(S.img||(S.img={}))[el.dataset.m]=null;dirty();render();toast('اتشالت الصورة')},
  sline:el=>{UI.s.line=el.dataset.v;render()},
  slist:()=>{UI.s.list=UI.s.list===false;try{localStorage.setItem(KEY+'-list',UI.s.list)}catch(e){}render()},
  sflt:el=>{UI.s.flt=el.dataset.v;render()},
  skuop:el=>{
    const t=el.dataset.t,sku=el.dataset.sku,k=SKU.get(sku);UI.sheet=null;
    const pre=t==='CNT'?{hdr:{models:[k.m]}}:{sku};
    go('ops',()=>{newDoc(t,pre)});
  },
  newop:el=>{const t=el.dataset.t;if(t==='SCN'){ACT.upload({dataset:{t:'scan'}});return}newDoc(t);render()},
  opf:el=>{UI.opF=el.dataset.v;render()},
  opendoc:el=>{UI.doc=el.dataset.id;UI.msg=null;render()},
  backops:()=>{const d=curDoc();if(d&&d.status==='draft'&&!d.lines.length&&d.type!=='CNT'&&d.type!=='SCN'){S.docs=S.docs.filter(x=>x!==d);dirty()}UI.doc=null;render()},
  deldoc:()=>{const d=curDoc();S.docs=S.docs.filter(x=>x!==d);UI.doc=null;dirty();toast('اتحذفت المسودة');render()},
  confirm:()=>{const d=curDoc();if(confirmDoc(d)){toast('اتأكدت '+d.no);render()}else toast('مش قادر أأكّد. شوف البنود الحمرا')},
  reverse:()=>{const d=curDoc(),r=reverseDoc(d);UI.msg=r.ok?null:'<b>مش هينفع تتعكس:</b><ul>'+r.err.slice(0,5).map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul>';if(r.ok)toast('اتعكست العملية');render()},
  pq:el=>{const i=$('#pkq');i.value=Math.max(1,(+i.value||1)+(+el.dataset.d))},
  addline:()=>{
    const d=curDoc(),m=$('#pkm').value,id=IDX[m+'|'+$('#pkc').value+'|'+$('#pks').value];if(!id)return;
    addLine(d,id,+$('#pkq').value);dirty();render();
  },
  rmline:el=>{const d=curDoc();d.lines.splice(+el.dataset.i,1);dirty();render()},
  ls:el=>{const d=curDoc(),l=d.lines[+el.dataset.i],f=el.dataset.f;l[f]=Math.max(0,num(l[f])+(+el.dataset.d));dirty();render()},
  cntm:el=>{const d=curDoc(),m=el.dataset.m,a=d.hdr.models,i=a.indexOf(m);if(i>=0)a.splice(i,1);else a.push(m);dirty();render()},
  cntstart:()=>{const d=curDoc(),H=d.hdr;H.started=true;H.snap={};H.cnt={};D.skus.forEach(k=>{if(H.models.indexOf(k.m)>=0){H.snap[k.id]=g(k.id,H.state);H.cnt[k.id]=''}});d.log.push(logE('بدأ الجرد لـ '+H.models.length+' موديل'));dirty();render()},
  cntreveal:()=>{const d=curDoc();d.hdr.reveal=true;dirty();render()},
  rtnfill:()=>{
    const d=curDoc(),codes=d.hdr.codes.split(/[\s,;]+/).map(x=>x.trim()).filter(Boolean),unk=[];
    codes.forEach(c=>{const o=S.orders.find(x=>x.ref.toLowerCase()===c.toLowerCase()||String(x.wb)===c);if(!o||o.st!=='done'){unk.push(c);return}o.lines.forEach(s=>addLine(d,s,1))});
    d.hdr.unk=unk;dirty();render();
  },
  suprcv:el=>{
    const id=el.dataset.id,i=$('#su-'+id),v=Math.floor(+i.value||0);if(v<=0){toast('اكتب كمية');return}
    const q=id==='CUP'?v*24:v;S.sup.log.push({t:Date.now(),date:S.date,item:id,q,why:id==='CUP'?'استلام '+v+' كيس':'استلام',doc:null});dirty();toast('اتسجّل الاستلام');render();
  },
  supcnt:el=>{
    const id=el.dataset.id,i=$('#su-'+id),raw=i.value;if(raw===''){toast('اكتب الكمية اللي عدّيتها');return}
    const c=Math.floor(+raw||0),cur=supBal(id),diff=c-(id==='CUP'?cur:cur);const v=id==='CUP'?c:c;
    S.sup.log.push({t:Date.now(),date:S.date,item:id,q:v-cur,why:'جرد: العدّ الفعلي '+v,doc:null});dirty();toast('اتعدّل الرصيد بالجرد');render();
  },
  instab:el=>{UI.ins=el.dataset.v;render()},
  ltab:el=>{UI.led.tab=el.dataset.v;render()},
  copyplan:()=>{
    const rows=planRows().sort((a,b)=>skuSort(a.id,b.id));
    copy('اقتراح تصنيع Fémini · '+S.date+'\n'+rows.map(r=>skuName(r.id)+' : '+r.q).join('\n')+'\nالإجمالي: '+rows.reduce((a,r)=>a+r.q,0),'اتنسخ اقتراح التصنيع');
  },
  reset:()=>{UI.confirmReset=!UI.confirmReset;render()},
  reset2:()=>{try{localStorage.removeItem(KEY)}catch(e){}S=seed();UI.confirmReset=false;UI.doc=null;UI.sheet=null;_bal=null;_ctx=null;toast('رجعنا للبيانات الأصلية');render()}
};
const CHG={
  wd:el=>{if(el.value){S.date=el.value;dirty();render()}},
  sel:el=>{UI.sel[el.dataset.ref]=el.checked;render()},
  upch:el=>{const s=UI.sheet;s.channel=el.value;if(s.rows){try{s.res=importRows(s.rows,s.channel,'__new__');s.err=''}catch(e){s.err=String(e.message||e)}}render()},
  updt:el=>{UI.sheet.date=el.value},
  hdate:el=>{const d=curDoc();d.date=el.value;dirty()},
  h:el=>{const d=curDoc();if(String(d.hdr[el.dataset.f])===el.value){return}d.hdr[el.dataset.f]=el.value;dirty();if(['to'].indexOf(el.dataset.f)>=0)render();else partial()},
  clnfrom:el=>{const d=curDoc();d.hdr.from=el.value;d.hdr.to=el.value==='DIRTY'?'SCRAP':'DIRTY';dirty();render()},
  fsdkind:el=>{const d=curDoc();d.hdr.kind=el.value;dirty();render()},
  pkm:el=>{UI.pk.m=el.value;const mm=MODEL.get(el.value);$('#pkc').innerHTML=mm.colors.map(c=>'<option>'+esc(c)+'</option>').join('');$('#pks').innerHTML=mm.sizes.map(c=>'<option>'+c+'</option>').join('');$('#pkhint').innerHTML=pkHint(srcLoc(curDoc()))},
  ln:el=>{const d=curDoc(),l=d.lines[+el.dataset.i],v=num(el.value);if(l[el.dataset.f]===v)return;l[el.dataset.f]=v;dirty();partial()},
  lres:el=>{const d=curDoc();d.lines[+el.dataset.i].res=el.value;dirty();partial()},
  cnt:el=>{const d=curDoc(),v=el.value===''?'':num(el.value);if(d.hdr.cnt[el.dataset.sku]===v)return;d.hdr.cnt[el.dataset.sku]=v;dirty();if(d.hdr.reveal)render();else partial()},
  cntstate:el=>{curDoc().hdr.state=el.value;dirty()},
  cntack:el=>{curDoc().hdr.ack=el.checked;dirty();partial()},
  rtncounted:el=>{curDoc().hdr.counted=el.checked;dirty();partial()},
  rtncodes:el=>{curDoc().hdr.codes=el.value;dirty()},
  photo:el=>{const d=curDoc(),f=el.files&&el.files[0];if(!f)return;const fr=new FileReader();fr.onload=()=>{PH[d.id]=fr.result;d.photo={name:f.name,size:f.size};dirty();render()};fr.readAsDataURL(f)},
  st:el=>{S.st[el.dataset.f]=Math.max(0,+el.value||0);dirty();toast('اتحفظ')},
  cost:el=>{const c=S.costs[el.dataset.m]||(S.costs[el.dataset.m]={});c[el.dataset.f]=+el.value||0;dirty();render()},
  actor:el=>{S.actor=el.value.trim()||'مصعب';dirty()},
  smsel:el=>{UI.s.m=el.value;render()},
  ltype:el=>{UI.led.type=el.value;render()}
};
const INP={
  h:el=>{const d=curDoc();d.hdr[el.dataset.f]=el.value;dirty();partial()},
  ln:el=>{const d=curDoc(),l=d.lines[+el.dataset.i];l[el.dataset.f]=num(el.value);dirty();partial()},
  cnt:el=>{const d=curDoc();if(d.hdr.reveal)return;d.hdr.cnt[el.dataset.sku]=el.value===''?'':num(el.value);dirty();partial()},
  oq:el=>{UI.o.q=el.value;UI.o.n=60;const l=ordFilter();$('#ordrows').innerHTML=l.length?ordRows(l):'<tr><td colspan="7" class="empty">مفيش أوردرات بالفلتر ده.</td></tr>'},
  sq:el=>{UI.s.q=el.value;$('#stres').innerHTML=stockTable()},
  lq:el=>{UI.led.q=el.value;$('#ledres').innerHTML=ledRows()},
  upemp:el=>{const s=UI.sheet;s.emp=el.value;const b=$('[data-a=scansave]');if(b&&s.res)b.disabled=!(s.res.matched.length&&el.value.trim())}
};
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-a]');if(!el)return;
  if(el.tagName==='TR'&&e.target.closest('input,[data-nodrill]'))return;
  if(ACT[el.dataset.a])ACT[el.dataset.a](el,e);
});
document.addEventListener('change',e=>{const el=e.target.closest('[data-c]');if(el&&CHG[el.dataset.c])CHG[el.dataset.c](el)});
document.addEventListener('input',e=>{const el=e.target.closest('[data-c]');if(el&&INP[el.dataset.c])INP[el.dataset.c](el)});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&UI.sheet){UI.sheet=null;render();return}
  if((e.key==='Enter'||e.key===' ')&&e.target.id==='dropz'){e.preventDefault();$('#upfile').click()}
});
document.addEventListener('dragover',e=>{const z=e.target.closest&&e.target.closest('#dropz');if(z){e.preventDefault();z.classList.add('on')}});
document.addEventListener('dragleave',e=>{const z=e.target.closest&&e.target.closest('#dropz');if(z)z.classList.remove('on')});
document.addEventListener('drop',e=>{const z=e.target.closest&&e.target.closest('#dropz');if(!z)return;e.preventDefault();const f=e.dataTransfer&&e.dataTransfer.files[0];if(f)handleFile(f)});
window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(VIEWS[h]&&h!==UI.tab){UI.tab=h;UI.sheet=null;render()}});
/* tooltip */
const tip=document.createElement('div');tip.id='tip';tip.hidden=true;document.body.appendChild(tip);
document.addEventListener('mouseover',e=>{
  const t=e.target.closest&&e.target.closest('[data-tip]');if(!t){tip.hidden=true;return}
  tip.style.whiteSpace='pre-line';tip.textContent=t.getAttribute('data-tip');tip.hidden=false;
  const r=t.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight,x=Math.min(Math.max(8,r.left+r.width/2-w/2),window.innerWidth-w-8);let y=r.top-h-8;if(y<8)y=r.bottom+8;tip.style.left=x+'px';tip.style.top=y+'px';
});
window.addEventListener('scroll',()=>{tip.hidden=true},{passive:true});

window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save()});
/* ---------- boot ---------- */
load();
try{theme=localStorage.getItem(KEY+'-theme')||'system'}catch(e){}
try{if(localStorage.getItem(KEY+'-list')==='false')UI.s.list=false}catch(e){}
applyTheme();
const fi=document.createElement('input');fi.type='file';fi.id='upfile';fi.accept='.xlsx,.xls,.csv';fi.hidden=true;document.body.appendChild(fi);
const ifl=document.createElement('input');ifl.type='file';ifl.id='imgfile';ifl.accept='image/*';ifl.hidden=true;document.body.appendChild(ifl);
ifl.addEventListener('change',()=>{const f=ifl.files&&ifl.files[0],m=UI.imgFor;ifl.value='';if(!f||!m)return;
  const fr=new FileReader();fr.onload=()=>{const im=new Image();im.onload=()=>{const k=Math.min(1,480/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);
    (S.img||(S.img={}))[m]=c.toDataURL('image/jpeg',.82);dirty();if(JSON.stringify(S).length>4.4e6)toast('تنبيه: مساحة التخزين في المتصفح قربت تخلص');else toast('اتحفظت صورة '+m);render()};im.onerror=()=>toast('الملف ده مش صورة');im.src=fr.result};fr.readAsDataURL(f)});
fi.addEventListener('change',()=>{const f=fi.files&&fi.files[0];fi.value='';if(f)handleFile(f)});
const h0=(location.hash||'').slice(1);if(VIEWS[h0])UI.tab=h0;
document.documentElement.lang='ar';document.documentElement.dir='rtl';
render();
window.__F={S:()=>S,UI,go,ctx,g,dirty,render};
})();
