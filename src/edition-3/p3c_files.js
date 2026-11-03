
/* ---------- photos: IndexedDB so document photos survive reload ---------- */
let IDBH=null;
function idbOpen(){return new Promise(res=>{try{const r=indexedDB.open('femini-v3',1);r.onupgradeneeded=()=>r.result.createObjectStore('ph');r.onsuccess=()=>res(r.result);r.onerror=()=>res(null);r.onblocked=()=>res(null)}catch(e){res(null)}})}
function phPut(id,data){if(!IDBH)return;try{IDBH.transaction('ph','readwrite').objectStore('ph').put(data,id)}catch(e){}}
function phClear(){Object.keys(PH).forEach(k=>delete PH[k]);if(!IDBH)return;try{IDBH.transaction('ph','readwrite').objectStore('ph').clear()}catch(e){}}
function phLoad(){return new Promise(res=>{if(!IDBH)return res();try{const rq=IDBH.transaction('ph').objectStore('ph').openCursor();rq.onsuccess=()=>{const c=rq.result;if(c){PH[c.key]=c.value;c.continue()}else res()};rq.onerror=()=>res()}catch(e){res()}})}
function phFromFile(f,cb){
  const fr=new FileReader();
  fr.onload=()=>{const im=new Image();im.onload=()=>{const k=Math.min(1,1400/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);cb(c.toDataURL('image/jpeg',.75))};im.onerror=()=>toast('الملف ده مش صورة');im.src=fr.result};
  fr.readAsDataURL(f);
}

/* ---------- Today tiles drill-down ---------- */
function ordsOfDay(){const ids=S.pickups.filter(p=>p.date===viewDate()).map(p=>p.id);return S.orders.filter(o=>ids.indexOf(o.pk)>=0&&o.st!=='cx')}
function flowSheet(w){
  const C=ctx(),os=ordsOfDay(),done=os.filter(o=>o.st==='done'),open=os.filter(o=>o.st==='open'),bl=open.filter(o=>C.blocked[o.ref]),wait=open.filter(o=>!C.blocked[o.ref]);
  const T={all:['المطلوب النهارده',os],done:['اتشحن النهارده',done],wait:['لسه ما اتشحنش',wait],blocked:['هيقف بالمخزون',bl]}[w]||['المطلوب',os];
  const list=T[1],pcs=list.reduce((a,o)=>a+o.lines.length,0),title=T[0]+' ('+list.length+' أوردر · '+fmt(pcs)+' قطعة)';
  if(!list.length)return {title,body:'<div class="empty">مفيش أوردرات هنا.</div>'};
  let body='';
  const rowsT=(rows,missing)=>'<div class="tw"><table class="t-sm"><thead><tr><th>الكود</th><th class="num">قطع</th><th>'+(missing?'الناقص فيه':'الحالة')+'</th></tr></thead><tbody>'+rows.map(o=>'<tr data-a="order" data-ref="'+esc(o.ref)+'"><td class="mono">'+esc(o.ref)+'</td><td class="num">'+N(o.lines.length)+'</td><td>'+(missing?C.blocked[o.ref].map(x=>'<span class="pill crit" style="margin:2px">'+esc(skuName(x[0]))+' ×'+x[1]+'</span>').join(' '):ordPill(o))+'</td></tr>').join('')+'</tbody></table></div>';
  const varT=(map,cols)=>{const ks=Object.keys(map).sort((a,b)=>map[b].n-map[a].n||skuSort(a,b));return '<div class="tw"><table class="t-sm"><thead><tr><th>الصنف</th><th class="num">جاهز</th><th class="num">'+cols[0]+'</th><th class="num">'+cols[1]+'</th></tr></thead><tbody>'+ks.slice(0,40).map(s=>'<tr data-a="sku" data-sku="'+s+'"><td>'+thumb(SKU.get(s).m,26)+' '+sw(SKU.get(s).c)+' '+esc(skuName(s))+'</td><td class="num">'+N(g(s,'READY'))+'</td><td class="num">'+(map[s].crit?pill('crit',map[s].q):N(map[s].q))+'</td><td class="num">'+N(map[s].n)+'</td></tr>').join('')+'</tbody></table></div>'};
  if(w==='blocked'){
    const byS={};bl.forEach(o=>C.blocked[o.ref].forEach(x=>{const e=byS[x[0]]||(byS[x[0]]={n:0,q:0,crit:1});e.n++;e.q+=x[1]}));
    body+='<div class="msg">الأوردر بيقف لو أي قطعة فيه ناقصة، لأنه بيتبعت كامل. الناقص محسوب على الجاهز دلوقتي ومتوزّع على الأوردرات بالترتيب.</div><h3 style="font-size:15px">الأصناف الناقصة <span class="muted" style="font-weight:400">(بتوقّف أكتر أوردرات الأول)</span></h3>'+varT(byS,['ناقص','أوردرات واقفة'])+'<h3 style="font-size:15px">الأوردرات الواقفة</h3>'+rowsT(bl,true);
  }else if(w==='wait'){
    const byS={};wait.forEach(o=>{const c={};o.lines.forEach(s=>c[s]=(c[s]||0)+1);Object.keys(c).forEach(s=>{const e=byS[s]||(byS[s]={n:0,q:0});e.n++;e.q+=c[s]})});
    body+='<div class="msg">دي أوردرات اتطلبت ومعاها رصيد، بس لسه ما اتشحنتش. الرصيد ما اتخصمش لسه.</div><h3 style="font-size:15px">القطع اللي لازم تتجهّز</h3>'+varT(byS,['مطلوب','في أوردرات'])+'<h3 style="font-size:15px">الأوردرات</h3>'+rowsT(wait.slice(0,80),false);
  }else if(w==='done'){
    const em={};done.forEach(o=>{const e=em[o.sc.by]||(em[o.sc.by]={o:0,p:0,a:o.sc.at,b:o.sc.at});e.o++;e.p+=o.lines.length;e.a=Math.min(e.a,o.sc.at);e.b=Math.max(e.b,o.sc.at)});
    body+='<h3 style="font-size:15px">حسب الموظف</h3><div class="tw"><table class="t-sm"><thead><tr><th>الموظف</th><th class="num">أوردرات</th><th class="num">قطع</th><th class="num">من - إلى</th></tr></thead><tbody>'+Object.keys(em).sort((a,b)=>em[b].o-em[a].o).map(k=>'<tr><td>'+esc(k)+'</td><td class="num">'+N(em[k].o)+'</td><td class="num">'+N(em[k].p)+'</td><td class="num mono">'+timeOf(em[k].a)+' - '+timeOf(em[k].b)+'</td></tr>').join('')+'</tbody></table></div><h3 style="font-size:15px">الأوردرات</h3>'+rowsT(done.slice(0,80),false);
  }else{
    body+='<h3 style="font-size:15px">حسب البيك أب</h3><div class="tw"><table class="t-sm"><thead><tr><th>البيك أب</th><th class="num">أوردرات</th><th class="num">اتشحن</th><th class="num">مستني</th><th class="num">هيقف</th></tr></thead><tbody>'+S.pickups.filter(p=>p.date===viewDate()).map(p=>{const po=os.filter(o=>o.pk===p.id);return '<tr><td><b>'+esc(p.label)+'</b><div class="muted" style="font-size:12px">'+esc(p.src||'')+'</div></td><td class="num">'+N(po.length)+'</td><td class="num">'+N(po.filter(o=>o.st==='done').length)+'</td><td class="num">'+N(po.filter(o=>o.st==='open'&&!C.blocked[o.ref]).length)+'</td><td class="num">'+N(po.filter(o=>o.st==='open'&&C.blocked[o.ref]).length)+'</td></tr>'}).join('')+'</tbody></table></div><h3 style="font-size:15px">الأوردرات</h3>'+rowsT(os.slice(0,80),false);
  }
  if(list.length>80)body+='<p class="muted" style="font-size:12px">أول 80 أوردر. الباقي في صفحة الأوردرات.</p>';
  body+='<button class="btn" data-a="of2" data-v="'+(w==='all'?'all':w)+'">افتحهم في صفحة الأوردرات</button>';
  return {title,body};
}

/* ---------- FILES page ---------- */
function vFiles(){
  const T=[['pk','ملفات البيك أب'],['sc','ملفات السكان'],['ph','صور المستندات']];
  let h=top('الملفات','كل اللي اترفع أو اتسجّل: ملفات البيك أب والسكان وصور الورق الموقّع. من هنا تعدّلها أو تحذفها أو تلاقي مكانها.','');
  h+='<div class="msg" style="margin-bottom:14px"><b>فين بتتحفظ ملفاتي؟</b><br>ملف Excel أو CSV نفسه مش بيتخزّن. السيستم بيقراه وبيحفظ البيانات اللي طلعت منه (الأوردرات والكميات) واسم الملف كمرجع. صور الورق الموقّع بتتحفظ في المتصفح ده بس. تقدر تعدّل كل حاجة من الجداول اللي تحت.</div>';
  h+='<div class="tabs" role="tablist">'+T.map(t=>'<button role="tab" aria-selected="'+(UI.fl===t[0])+'" data-a="fltab" data-v="'+t[0]+'">'+t[1]+'</button>').join('')+'</div>';
  if(UI.fl==='sc'){
    const ds=S.docs.filter(d=>d.type==='SCN').slice().reverse();
    return h+(ds.length?'<div class="tw"><table><thead><tr><th>الرقم</th><th>الموظف</th><th>الملف</th><th>التاريخ</th><th class="num">أوردرات</th><th class="num">قطع</th><th>الحالة</th><th></th></tr></thead><tbody>'+ds.map(d=>{const pc=d.hdr.refs.reduce((a,r)=>a+((orderByRef(r)||{lines:[]}).lines.length),0);return '<tr><td class="mono">'+(d.no||'—')+'</td><td>'+esc(d.hdr.emp)+'</td><td class="muted">'+esc(d.hdr.src||'')+'</td><td class="mono">'+d.date+'</td><td class="num">'+N(d.hdr.refs.length)+'</td><td class="num">'+N(pc)+'</td><td>'+(d.status==='done'?pill('good','مؤكد'):d.status==='reversed'?pill('','معكوس'):pill('warn','مسودة'))+'</td><td><button class="btn sm" data-a="scedit" data-id="'+d.id+'">'+(d.status==='done'?'تعديل':'فتح')+'</button></td></tr>'}).join('')+'</tbody></table></div>':'<div class="card"><div class="empty">لسه مفيش ملفات سكان. ارفع ملف من صفحة الأوردرات.</div></div>');
  }
  if(UI.fl==='ph'){
    const ds=S.docs.filter(d=>d.type==='RCV'||d.type==='SHP').slice().reverse();
    return h+(ds.length?'<div class="grid g3">'+ds.map(d=>{const u=PH[d.id],pc=d.lines.reduce((a,l)=>a+num(l.q),0);return '<button class="card flat" style="all:unset;box-sizing:border-box;cursor:pointer;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px;display:grid;gap:8px" data-a="opendoc2" data-id="'+d.id+'">'+(u?'<img src="'+u+'" alt="" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px;border:1px solid var(--line)">':'<span class="empty" style="aspect-ratio:4/3;display:grid;place-items:center;border:1px dashed var(--line2);border-radius:10px;padding:8px">'+(d.photo?'الصورة مش محفوظة بعد إعادة التحميل. ارفعها تاني':'مفيش صورة')+'</span>')+'<span class="row sp"><b>'+OT[d.type].ar+' <span class="mono">'+(d.no||'مسودة')+'</span></b>'+(d.status==='done'?pill('good','مؤكد'):d.status==='reversed'?pill('','معكوس'):pill('warn','مسودة'))+'</span><span class="muted" style="font-size:12px">'+d.date+' · '+fmt(pc)+' قطعة</span></button>'}).join('')+'</div>':'<div class="card"><div class="empty">لسه مفيش استلام أو توريد للمحل. الصور بتتضاف مع العملية.</div></div>');
  }
  const ps=S.pickups.slice().reverse();
  return h+(ps.length?'<div class="tw"><table><thead><tr><th>البيك أب</th><th>الملف</th><th>التاريخ</th><th>القناة</th><th class="num">أوردرات</th><th class="num">اتشحن</th><th></th></tr></thead><tbody>'+ps.map(p=>{const po=S.orders.filter(o=>o.pk===p.id&&o.st!=='cx');return '<tr><td><b>'+esc(p.label)+'</b></td><td class="muted">'+esc(p.src||'')+'</td><td class="mono">'+esc(p.date)+'</td><td>'+esc(chanName(p.channel))+'</td><td class="num">'+N(po.length)+'</td><td class="num">'+N(po.filter(o=>o.st==='done').length)+'</td><td><button class="btn sm" data-a="pkedit" data-id="'+p.id+'">تعديل</button></td></tr>'}).join('')+'</tbody></table></div>':'<div class="card"><div class="empty">لسه مفيش بيك أب. ارفع ملف من صفحة الأوردرات.</div></div>');
}
function pkEditSheet(s){
  const p=S.pickups.find(x=>x.id===s.id);if(!p)return {title:'',body:''};
  const po=S.orders.filter(o=>o.pk===p.id),dn=po.filter(o=>o.st==='done').length,pc=po.reduce((a,o)=>a+o.lines.length,0);
  let body='<div class="kpis">'+kpi('أوردرات',N(po.length),fmt(pc)+' قطعة')+kpi('اتشحن',N(dn),'',dn?'good':'')+'</div><div class="muted" style="font-size:13px">الملف الأصلي: <b>'+esc(p.src||'—')+'</b></div>';
  body+='<div class="grid g2">'+'<label class="f" style="grid-column:1/-1">اسم البيك أب<input value="'+esc(s.f.label)+'" data-c="pkf" data-f="label"></label><label class="f">التاريخ<input type="date" value="'+esc(s.f.date)+'" data-c="pkf" data-f="date"></label><label class="f">القناة<select data-c="pkf" data-f="channel">'+CHAN.map(c=>'<option value="'+c.id+'" '+(s.f.channel===c.id?'selected':'')+'>'+c.name+'</option>').join('')+'</select></label></div>';
  if(s.err)body+='<div class="msg crit">'+esc(s.err)+'</div>';
  body+='<div class="row"><button class="btn pri" data-a="pksave2">حفظ التعديل</button><button class="btn" data-a="of3" data-id="'+p.id+'">فتح أوردراته</button></div>';
  body+='<div class="card flat" style="margin-top:6px"><h2 style="font-size:15px">حذف البيك أب</h2>';
  if(dn)body+='<div class="msg warn">مينفعش تحذفه لأن فيه '+dn+' أوردر اتشحن (الرصيد اتخصم). اعكس عمليات السكان الأول من صفحة العمليات.</div>';
  else body+=s.del?'<div class="msg crit">هتتمسح '+po.length+' أوردر من "'+esc(p.label)+'" ومش هيتحسبوا كطلب. متأكد؟<div class="row" style="margin-top:8px"><button class="btn danger sm" data-a="pkdel2">أيوه، احذف</button><button class="btn sm" data-a="pkdel">لأ</button></div></div>':'<p class="muted" style="margin-bottom:10px">بيمسح الأوردرات المفتوحة بتاعته. مش بيأثّر على المخزون لأن البيك أب مش بيخصم.</p><button class="btn danger sm" data-a="pkdel">حذف البيك أب</button>';
  return {title:p.label,body:body+'</div>'};
}
function scEditSheet(s){
  const d=S.docs.find(x=>x.id===s.id);if(!d)return {title:'',body:''};
  const pc=d.hdr.refs.reduce((a,r)=>a+((orderByRef(r)||{lines:[]}).lines.length),0);
  let body='<div class="kpis">'+kpi('أوردرات',N(d.hdr.refs.length),fmt(pc)+' قطعة')+kpi('الحالة',d.status==='done'?'مؤكد':d.status==='reversed'?'معكوس':'مسودة','')+'</div><div class="muted" style="font-size:13px">رقم <b class="mono">'+(d.no||'—')+'</b> · '+d.date+'<br>الملف الأصلي: <b>'+esc(d.hdr.src||'—')+'</b></div>';
  if(d.status==='done'){
    body+='<label class="f">اسم الموظف<input value="'+esc(s.emp)+'" data-c="scemp" id="scemp"></label><div class="row"><button class="btn pri" data-a="scsave">حفظ اسم الموظف</button><button class="btn" data-a="opendoc2" data-id="'+d.id+'">فتح العملية</button></div><p class="muted" style="font-size:12px">تغيير الاسم بيحدّث الأوردرات وإحصائيات الموظفين. حركات المخزون القديمة بتفضل زي ما هي في السجل.</p>';
    if(s.err)body+='<div class="msg crit">'+esc(s.err)+'</div>';
    body+='<div class="card flat" style="margin-top:6px"><h2 style="font-size:15px">عكس الملف كله</h2>'+(s.rev?'<div class="msg crit">هيرجّع '+d.hdr.refs.length+' أوردر "مستني الشحن" ويرجّع '+fmt(pc)+' قطعة للمخزون والمستلزمات. متأكد؟<div class="row" style="margin-top:8px"><button class="btn danger sm" data-a="screv2">أيوه، اعكس</button><button class="btn sm" data-a="screv">لأ</button></div></div>':'<p class="muted" style="margin-bottom:10px">لو رفعت الملف بالغلط. بيسجّل حركة عكسية ومش بيمسح القديم.</p><button class="btn danger sm" data-a="screv">عكس الملف</button>')+'</div>';
  }else body+='<button class="btn" data-a="opendoc2" data-id="'+d.id+'">فتح العملية</button>';
  return {title:'ملف سكان · '+esc(d.hdr.emp),body};
}
