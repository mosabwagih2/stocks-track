/* ---------- v2: shop supplies. Pick, save (date and time are kept), print a delivery note, mark it delivered, track every shop. ---------- */
const shpNo=d=>d.no||'مسودة';
function shpRows(d){
  const a={};d.lines.forEach(l=>{a[l.sku]=(a[l.sku]||0)+num(l.q)});
  return Object.keys(a).filter(k=>a[k]>0&&SKU.get(k)).sort(skuSort).map(k=>{const s=SKU.get(k),c=S.costs[s.m]||{};return {sku:k,model:s.m,mname:MODEL.get(s.m).name,color:s.c,size:s.s,q:a[k],price:+c.price||0}});
}
const shpHasPrices=d=>can('money')&&shpRows(d).some(r=>r.price>0);
function shpWhen(d){const t=d.confirmedAt||Date.now();return {date:d.date||S.date,time:timeOf(t)}}
function shpNoteHTML(d,opt){
  opt=opt||{};const rows=shpRows(d),W=shpWhen(d),H=d.hdr||{},prices=!!opt.prices&&shpHasPrices(d),tot=rows.reduce((a,r)=>a+r.q,0),val=rows.reduce((a,r)=>a+r.q*r.price,0);
  const block=copy=>'<section class="pg"><header><div class="br"><b>Fémini</b><small>مخزن</small></div><div class="tt"><h1>إذن تسليم بضاعة</h1><span class="cp">'+copy+'</span></div><div class="no"><b>'+esc(shpNo(d))+'</b><small>'+esc(W.date)+' · '+esc(W.time)+'</small></div></header>'
   +'<div class="meta"><div><small>من</small><b>مخزن Fémini</b></div><div><small>إلى</small><b>'+esc(H.shop||'—')+'</b></div><div><small>أعدّه</small><b>'+esc(d.by||'')+'</b></div></div>'
   +'<table><thead><tr><th>م</th><th>الموديل</th><th>الوصف</th><th>اللون</th><th>المقاس</th><th class="n">الكمية</th>'+(prices?'<th class="n">السعر</th><th class="n">الإجمالي</th>':'')+'</tr></thead><tbody>'
   +rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td class="m">'+esc(r.model)+'</td><td>'+esc(r.mname)+'</td><td>'+esc(r.color)+'</td><td>'+esc(r.size)+'</td><td class="n"><b>'+r.q+'</b></td>'+(prices?'<td class="n">'+fmt(r.price)+'</td><td class="n">'+fmt(r.q*r.price)+'</td>':'')+'</tr>').join('')
   +'</tbody><tfoot><tr><td colspan="5">الإجمالي · '+rows.length+' صنف</td><td class="n"><b>'+tot+'</b></td>'+(prices?'<td></td><td class="n"><b>'+fmt(val)+'</b></td>':'')+'</tr></tfoot></table>'
   +(H.note?'<p class="nt"><b>ملاحظات:</b> '+esc(H.note)+'</p>':'')
   +'<p class="rv">راجع الكميات قبل التوقيع على الاستلام.</p>'
   +'<div class="sg"><div><small>سلّمه (المخزن)</small><i></i></div><div><small>استلمه (المحل): الاسم</small><i></i></div><div><small>التوقيع</small><i></i></div><div><small>التاريخ</small><i></i></div></div></section>';
  return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>إذن تسليم '+esc(shpNo(d))+'</title><style>'
   +'*{box-sizing:border-box}body{margin:0;background:#fff;color:#1c1530;font:13px/1.6 "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif}.pg{width:190mm;max-width:100%;margin:0 auto;padding:10mm 0;page-break-after:always}.pg:last-child{page-break-after:auto}'
   +'header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:2px solid #1c1530;padding-bottom:8px;margin-bottom:10px}.br b{font:600 22px Georgia,serif;display:block;line-height:1}.br small{color:#6b6379}.tt{text-align:center}.tt h1{margin:0;font-size:20px}.cp{display:inline-block;margin-top:4px;padding:1px 12px;border:1px solid #1c1530;border-radius:99px;font-size:12px}.no{text-align:left}.no b{font:600 16px monospace;display:block;direction:ltr}.no small{color:#6b6379}'
   +'.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}.meta div{border:1px solid #d5cdbf;border-radius:8px;padding:6px 10px}.meta small{display:block;color:#6b6379;font-size:11px}'
   +'table{width:100%;border-collapse:collapse}th,td{border:1px solid #d5cdbf;padding:5px 8px;text-align:right}th{background:#f0ece4;font-size:12px}.n{text-align:center}.m{font-family:monospace;font-weight:600}tfoot td{background:#f0ece4;font-weight:600}'
   +'.nt{margin:10px 0 0}.rv{color:#6b6379;font-size:12px;margin:10px 0}.sg{display:grid;grid-template-columns:1.2fr 1.6fr 1fr 1fr;gap:10px;margin-top:22px}.sg small{display:block;color:#6b6379;font-size:11px}.sg i{display:block;border-bottom:1px solid #1c1530;height:34px}'
   +'@page{size:A4;margin:8mm}@media print{.pg{padding:0}}</style></head><body>'+block('نسخة المحل')+block('نسخة المخزن')+'</body></html>';
}
function shpAOA(d,opt){
  const rows=shpRows(d),W=shpWhen(d),prices=!!(opt&&opt.prices)&&shpHasPrices(d),H=d.hdr||{};
  const out=[['إذن تسليم بضاعة · Fémini'],['الرقم',shpNo(d),'التاريخ',W.date,'الوقت',W.time],['من','مخزن Fémini','إلى',H.shop||'','أعدّه',d.by||''],[]];
  out.push(['م','الموديل','الوصف','اللون','المقاس','الكمية'].concat(prices?['السعر','الإجمالي']:[]));
  rows.forEach((r,i)=>out.push([i+1,r.model,r.mname,r.color,r.size,r.q].concat(prices?[r.price,r.q*r.price]:[])));
  out.push(['','','','','إجمالي القطع',rows.reduce((a,r)=>a+r.q,0)].concat(prices?['',rows.reduce((a,r)=>a+r.q*r.price,0)]:[]));
  if(H.note)out.push([],['ملاحظات',H.note]);
  return out;
}
async function saveFile(fn,blob,okMsg){
  let dl=null;try{dl=window.claude&&window.claude.use?await window.claude.use('downloads'):null}catch(e){dl=null}
  if(dl){try{await dl.save({filename:fn,data:blob});toast(okMsg)}catch(e){toast(e&&e.code==='declined'?'اتلغى التنزيل':'التنزيل مش متاح هنا. افتح الصفحة في المتصفح العادي وجرّب تاني.')}return}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fn;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);toast(okMsg);
}
function shpPrint(html){
  const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-9999px;width:0;height:0;border:0';f.srcdoc=html;
  f.onload=()=>{try{f.contentWindow.focus();f.contentWindow.print()}catch(e){toast('الطباعة مش متاحة هنا. نزّل الملف وافتحه من المتصفح.')}setTimeout(()=>f.remove(),60000)};document.body.appendChild(f);
}
function shpNoteSheet(s){
  const d=S.docs.find(x=>x.id===s.id);if(!d)return {title:'إذن تسليم',body:''};
  const hp=shpHasPrices(d);
  return {title:'إذن تسليم '+shpNo(d),body:'<div class="row sp" style="margin-bottom:10px;gap:8px;flex-wrap:wrap"><span class="row" style="gap:8px"><button class="btn pri" data-a="shpprint">طباعة</button><button class="btn" data-a="shpdl">تنزيل (HTML)</button><button class="btn" data-a="shpxls">تنزيل (Excel)</button></span>'+(hp?'<label class="row" style="gap:6px;font-size:13px"><input type="checkbox" data-c="shpprices" '+(s.prices?'checked':'')+'> اعرض الأسعار</label>':'')+'</div><p class="muted" style="font-size:12.5px;margin:0 0 10px">نسختين في الملف: نسخة للمحل ونسخة للمخزن، وفيه مكان للتوقيع والتاريخ.</p><iframe class="notef" title="إذن التسليم" srcdoc="'+esc(shpNoteHTML(d,{prices:s.prices}))+'"></iframe>'};
}
/* ---------- delivery tracking inside the document ---------- */
function shpCard(d){
  if(d.status!=='done')return '';
  const dv=(d.hdr||{}).delivered,W=shpWhen(d);
  let h='<section class="card"><h2>التسليم للمحل</h2><div class="msg good" style="margin-bottom:10px">اتسجّل يوم <b>'+esc(W.date)+'</b> الساعة <b>'+esc(W.time)+'</b> · '+fmt(shpRows(d).reduce((a,r)=>a+r.q,0))+' قطعة خرجت من المخزن للمحل.</div>';
  h+='<div class="row" style="gap:8px;margin-bottom:12px"><button class="btn pri" data-a="shpnote" data-id="'+d.id+'">إذن التسليم (طباعة / تنزيل)</button></div>';
  if(dv)h+='<div class="msg good"><b>اتسلّم للمحل</b> '+esc(dv.date||'')+(dv.at?' · '+timeOf(dv.at):'')+(dv.receiver?' · استلمه '+esc(dv.receiver):'')+' · سجّله '+esc(dv.by||'')+'</div>';
  else h+='<div class="msg warn" style="margin-bottom:10px">لسه ما اتسلّمش للمحل. لما توصّله وتاخد التوقيع، سجّل التسليم.</div><div class="row" style="gap:8px;flex-wrap:wrap"><input data-c="shprecv" placeholder="اسم اللي استلم في المحل (اختياري)" value="'+esc(UI.shpRecv||'')+'" style="flex:1;min-width:200px"><button class="btn" data-a="shpdone">تم التسليم للمحل</button></div>';
  h+='<div style="margin-top:12px">'+(PH[d.id]?'<img src="'+PH[d.id]+'" alt="الإذن الموقّع" style="width:100%;max-width:420px;border-radius:10px;border:1px solid var(--line)">':'')+'<label class="f" style="margin-top:8px">'+(PH[d.id]?'تغيير صورة الإذن الموقّع':'صورة الإذن الموقّع (اختياري، بعد التسليم)')+'<input type="file" accept="image/*" data-c="photo"></label></div></section>';
  return h;
}
/* ---------- the shop page (a tab inside Operations) ---------- */
function opTabs(){const t=UI.opTab==='shop'?'shop':'all';return '<div class="seg" role="tablist" style="margin-bottom:14px"><button role="tab" aria-pressed="'+(t==='all')+'" data-a="optab" data-v="all">كل العمليات</button><button role="tab" aria-pressed="'+(t==='shop')+'" data-a="optab" data-v="shop">توريدات المحل</button></div>'}
function shopData(){
  const L=UI.shp||(UI.shp={shop:'',st:'all',q:''}),all=S.docs.filter(d=>d.type==='SHP'&&d.status==='done').slice().reverse();
  const shops=[...new Set(S.shops.concat(all.map(d=>d.hdr.shop||'').filter(Boolean)))],q=arN((L.q||'').trim());
  const list=all.filter(d=>(!L.shop||(d.hdr.shop||'')===L.shop)&&(L.st==='all'||(L.st==='pend')===!d.hdr.delivered)&&(!q||arN((d.no||'')+' '+(d.hdr.shop||'')+' '+(d.hdr.note||'')).indexOf(q)>=0));
  return {L,all,shops,list};
}
function shopListHTML(X){
  const {L,all,shops,list}=X;let h='';
  if(!all.length)return '<div class="card"><div class="empty">لسه مفيش توريدات للمحل. اضغط "توريد جديد للمحل" واختار القطع.</div></div>';
  if(!list.length)return '<div class="card"><div class="empty">مفيش توريدات بالفلتر ده.</div></div>';
  const hp=can('money'),pcs=d=>shpRows(d).reduce((a,r)=>a+r.q,0);
  h+='<div class="tw"><table class="dt shpt"><thead><tr><th>الرقم</th><th>التاريخ</th><th>المحل</th><th class="num">قطع</th><th class="num">أصناف</th>'+(hp?'<th class="num">القيمة</th>':'')+'<th>الحالة</th><th></th></tr></thead><tbody>'+list.map(d=>{const rs=shpRows(d),v=rs.reduce((a,r)=>a+r.q*r.price,0),W=shpWhen(d);
    return '<tr data-a="opendoc" data-id="'+d.id+'" style="cursor:pointer"><td class="mono"><b>'+esc(d.no)+'</b></td><td>'+esc(W.date)+'<div class="muted" style="font-size:11.5px">'+esc(W.time)+'</div></td><td><b>'+esc(d.hdr.shop||'—')+'</b></td><td class="num"><b class="n">'+fmt(rs.reduce((a,r)=>a+r.q,0))+'</b></td><td class="num">'+rs.length+'</td>'+(hp?'<td class="num">'+(v?EGP(v):'<span class="muted">—</span>')+'</td>':'')+'<td>'+(d.hdr.delivered?pill('good','اتسلّم'+(d.hdr.delivered.receiver?' · '+esc(d.hdr.delivered.receiver):'')):pill('warn','لسه ما اتسلّمش'))+'</td><td data-nodrill><button class="btn sm" data-a="shpnote" data-id="'+d.id+'">إذن</button></td></tr>'}).join('')+'</tbody></table></div>';
  if(shops.length>1&&!L.shop)h+='<div class="gh" style="margin-top:18px">حسب المحل</div><div class="grid g3">'+shops.map(s=>{const ds=all.filter(d=>(d.hdr.shop||'')===s);return ds.length?'<div class="kpi"><small>'+esc(s)+'</small><b>'+fmt(ds.reduce((a,d)=>a+pcs(d),0))+'</b><em>'+ds.length+' توريدة · آخر واحدة '+esc(ds[0].date)+'</em></div>':''}).join('')+'</div>';
  return h;
}
function shopPage(){
  const X=shopData(),{L,all,shops}=X,pcs=d=>shpRows(d).reduce((a,r)=>a+r.q,0),pend=all.filter(d=>!d.hdr.delivered).length;
  let h='<div class="strip" style="margin-bottom:14px">'+[si('توريدات',N(all.length),shops.length+' محل'),si('قطع اتوردت',N(all.reduce((a,d)=>a+pcs(d),0)),'للمحلات'),si('لسه ما اتسلّمتش',N(pend),'توريدة',pend?'warn':'good'),si('آخر توريد',all[0]?esc(all[0].date):'—',all[0]?esc(all[0].hdr.shop||''):'')].join('')+'</div>';
  h+='<div class="row sp" style="margin-bottom:12px;gap:8px;flex-wrap:wrap"><div class="chips scrollx"><button class="chip" aria-pressed="'+(!L.shop)+'" data-a="shpf" data-k="shop" data-v="">كل المحلات</button>'+shops.map(s=>'<button class="chip" aria-pressed="'+(L.shop===s)+'" data-a="shpf" data-k="shop" data-v="'+esc(s)+'">'+esc(s)+'</button>').join('')+'</div><button class="btn pri" data-a="newop" data-t="SHP">+ توريد جديد للمحل</button></div>';
  h+='<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:12px"><div class="seg" role="group">'+[['all','الكل'],['pend','لسه ما اتسلّمش'],['done','اتسلّم']].map(x=>'<button aria-pressed="'+(L.st===x[0])+'" data-a="shpf" data-k="st" data-v="'+x[0]+'">'+x[1]+'</button>').join('')+'</div><input type="search" data-c="shpq" placeholder="دوّر: رقم أو اسم محل" value="'+esc(L.q||'')+'" aria-label="بحث" style="min-width:200px;flex:1;max-width:320px"></div>';
  return h+'<div id="shpres">'+shopListHTML(X)+'</div>';
}
const ACT_SH={
  optab:el=>{UI.opTab=el.dataset.v;UI.doc=null;render()},
  shpf:el=>{const L=UI.shp||(UI.shp={shop:'',st:'all',q:''});L[el.dataset.k]=el.dataset.v;render()},
  shpnote:el=>{UI.sheet={kind:'shpnote',id:el.dataset.id,prices:false};render()},
  shpprint:()=>{const s=UI.sheet,d=S.docs.find(x=>x.id===(s||{}).id);if(d)shpPrint(shpNoteHTML(d,{prices:s.prices}))},
  shpdl:()=>{const s=UI.sheet,d=S.docs.find(x=>x.id===(s||{}).id);if(d)saveFile('delivery-note-'+d.no+'.html',new Blob([shpNoteHTML(d,{prices:s.prices})],{type:'text/html'}),'اتنزّل إذن التسليم')},
  shpxls:()=>{const s=UI.sheet,d=S.docs.find(x=>x.id===(s||{}).id);if(!d)return;if(typeof XLSX==='undefined'){toast('ملف Excel مش متاح دلوقتي (محتاج إنترنت). نزّل الـ HTML.');return}
    const ws=XLSX.utils.aoa_to_sheet(shpAOA(d,{prices:s.prices})),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'اذن تسليم');const buf=XLSX.write(wb,{bookType:'xlsx',type:'array'});saveFile('delivery-note-'+d.no+'.xlsx',new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'اتنزّل ملف Excel')},
  shpdone:()=>{const d=curDoc();if(!d||d.status!=='done'||d.hdr.delivered)return;d.hdr.delivered={at:Date.now(),date:S.date,by:S.actor,receiver:(UI.shpRecv||'').trim()};UI.shpRecv='';audit('تسليم '+d.no+' للمحل');dirty();toast('اتسجّل التسليم للمحل');render()}
};
const CHG_SH={
  shpprices:el=>{if(UI.sheet){UI.sheet.prices=el.checked;render()}}
};
const INP_SH={
  shprecv:el=>{UI.shpRecv=el.value},
  shpq:el=>{(UI.shp||(UI.shp={shop:'',st:'all',q:''})).q=el.value;const r=$('#shpres');if(r)r.innerHTML=shopListHTML(shopData());_L.main=null}
};
