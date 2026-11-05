/* ---------- v2: shop supplies. Pick, save (date and time are kept), print a delivery note, mark it delivered, track every shop. ---------- */
const shpNo=d=>d.no||'مسودة';
function shpRows(d){
  const a={};d.lines.forEach(l=>{a[l.sku]=(a[l.sku]||0)+num(l.q)});
  return Object.keys(a).filter(k=>a[k]>0&&SKU.get(k)).sort(skuSort).map(k=>{const s=SKU.get(k),c=S.costs[s.m]||{};return {sku:k,model:s.m,mname:MODEL.get(s.m).name,color:s.c,size:s.s,q:a[k],price:+c.price||0}});
}
const shpHasPrices=d=>can('money')&&shpRows(d).some(r=>r.price>0);
function shpWhen(d){const t=d.confirmedAt||Date.now();return {date:d.date||S.date,time:timeOf(t)}}
const SHP_LOGO='__SHP_LOGO__';
function shpPages(rows){
  const FULL=22,LAST=18,out=[];let r=rows.slice();
  if(!r.length)return [[]];
  while(r.length>LAST){let take=Math.min(FULL,r.length);if(r.length>LAST&&r.length<=FULL)take=r.length-4;out.push(r.slice(0,take));r=r.slice(take)}
  out.push(r);return out;
}
function shpNoteHTML(d,opt){
  opt=opt||{};const rows=shpRows(d),W=shpWhen(d),H=d.hdr||{},prices=!!opt.prices&&shpHasPrices(d),tot=rows.reduce((a,r)=>a+r.q,0),val=rows.reduce((a,r)=>a+r.q*r.price,0),pages=shpPages(rows);let n=0;
  const head='<header><div class="br"><img src="'+SHP_LOGO+'" alt="Fémini"></div><div class="tt"><h1>إذن تسليم بضاعة</h1></div><div class="no"><b>'+esc(shpNo(d))+'</b><small>'+esc(W.date)+' · '+esc(W.time)+'</small></div></header>'
   +'<div class="meta"><div><small>من</small><b>مخزن Fémini</b></div><div><small>إلى</small><b>'+esc(H.shop||'—')+'</b></div><div><small>أعدّه</small><b>'+esc(d.by||'')+'</b></div></div>';
  const sheets=pages.map((pr,pi)=>{const last=pi===pages.length-1;
    const tr=pr.map(r=>{n++;return '<tr><td>'+n+'</td><td class="m">'+esc(r.model)+'</td><td class="d">'+esc(r.mname)+'</td><td>'+esc(r.color)+'</td><td>'+esc(r.size)+'</td><td class="n"><b>'+r.q+'</b></td>'+(prices?'<td class="n">'+fmt(r.price)+'</td><td class="n">'+fmt(r.q*r.price)+'</td>':'')+'</tr>'}).join('');
    return '<section class="sheet">'+head+'<div class="mid"><table><thead><tr><th>م</th><th>الموديل</th><th>الوصف</th><th>اللون</th><th>المقاس</th><th class="n">الكمية</th>'+(prices?'<th class="n">السعر</th><th class="n">الإجمالي</th>':'')+'</tr></thead><tbody>'+tr+'</tbody>'
     +(last?'<tfoot><tr><td colspan="5">الإجمالي · '+rows.length+' صنف</td><td class="n"><b>'+tot+'</b></td>'+(prices?'<td></td><td class="n"><b>'+fmt(val)+'</b></td>':'')+'</tr></tfoot>':'')+'</table>'
     +(last?(H.note?'<p class="nt"><b>ملاحظات:</b> '+esc(H.note)+'</p>':'')+'<p class="rv">راجع الكميات قبل التوقيع على الاستلام.</p>':'<p class="rv">يتبع في الصفحة التالية ←</p>')+'</div>'
     +'<div class="sg"><div><small>توقيع مستلم الاستور</small><i></i></div><div><small>توقيع أمين المخزن</small><i></i></div></div><div class="pn">صفحة '+(pi+1)+' من '+pages.length+'</div></section>'}).join('');
  return '<!doctype html><html lang="ar" dir="rtl" class="'+(opt.exp?'x':'')+'"><head><meta charset="utf-8"><title>إذن تسليم '+esc(shpNo(d))+'</title><style>'
   +'*{box-sizing:border-box}html,body{margin:0}body{color:#1f1738;font:13px/1.5 "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
   +'.sheet{position:relative;width:210mm;height:297mm;overflow:hidden;background:#fff;page-break-after:always;break-after:page}.sheet:last-child{page-break-after:auto;break-after:auto}'
   +'header{position:absolute;top:9mm;left:10mm;right:10mm;height:24mm;display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:2px solid #43316f}.br img{height:20mm;width:auto;display:block}.tt{text-align:center}.tt h1{margin:0;font-size:20px}.no{text-align:left}.no b{font:600 16px monospace;display:block;direction:ltr}.no small{color:#655e80}'
   +'.meta{position:absolute;top:36mm;left:10mm;right:10mm;height:14mm;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.meta div{border:1px solid #d3cbe6;border-radius:8px;padding:2px 10px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.meta small{display:block;color:#655e80;font-size:10.5px;line-height:1.3}.meta b{line-height:1.3}'
   +'.mid{position:absolute;top:54mm;left:10mm;right:10mm;bottom:50mm}'
   +'table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #d3cbe6;padding:0 8px;text-align:right;height:7.4mm;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12.5px}th{background:#f3f0f9;font-size:12px;height:8mm}.n{text-align:center}.m{font-family:monospace;font-weight:600}tfoot td{background:#f3f0f9;font-weight:600;height:8mm}'
   +'th:nth-child(1),td:nth-child(1){width:9mm}th:nth-child(2),td:nth-child(2){width:24mm}th:nth-child(3),td:nth-child(3){width:'+(prices?'38mm':'54mm')+'}'
   +'.nt{margin:8px 0 0}.rv{color:#655e80;font-size:12px;margin:8px 0 0}'
   +'.sg{position:absolute;left:10mm;right:10mm;bottom:14mm;height:30mm;display:grid;grid-template-columns:1fr 1fr;gap:40px}.sg>div{border-bottom:1px solid #1f1738;padding-top:2px}.sg small{display:block;color:#655e80;font-size:11px}.sg i{display:block}'
   +'.pn{position:absolute;left:0;right:0;bottom:6mm;text-align:center;color:#a59cc0;font-size:10.5px}'
   +'@page{size:A4;margin:0}@media screen{html:not(.x) body{background:#e9e6f0;padding:12px 0}html:not(.x) .sheet{margin:0 auto 14px;box-shadow:0 2px 10px rgba(31,23,56,.18)}}'
   +'@media screen and (max-width:830px){html:not(.x) body{zoom:.9}}@media screen and (max-width:740px){html:not(.x) body{zoom:.8}}@media screen and (max-width:660px){html:not(.x) body{zoom:.7}}@media screen and (max-width:580px){html:not(.x) body{zoom:.62}}@media screen and (max-width:500px){html:not(.x) body{zoom:.52}}@media screen and (max-width:430px){html:not(.x) body{zoom:.44}}@media screen and (max-width:360px){html:not(.x) body{zoom:.38}}'
   +'</style></head><body>'+sheets+'</body></html>';
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
const SHP_LIBS={h2c:'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',pdf:'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'};
function shpLoad(url,test){return new Promise((res,rej)=>{if(test()){res();return}const e=document.createElement('script');e.src=url;e.onload=()=>test()?res():rej(new Error('lib'));e.onerror=()=>rej(new Error('load'));document.head.appendChild(e)})}
async function shpCanvases(d,opt){
  await shpLoad(SHP_LIBS.h2c,()=>!!window.html2canvas);
  const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0';f.srcdoc=shpNoteHTML(d,Object.assign({},opt,{exp:true}));document.body.appendChild(f);
  try{
    await new Promise((r,j)=>{f.onload=r;setTimeout(()=>j(new Error('timeout')),15000)});
    const doc=f.contentDocument;try{await doc.fonts.ready}catch(e){}
    const img=doc.querySelector('header img');if(img&&!img.complete)await new Promise(r=>{img.onload=r;img.onerror=r});
    f.style.height=doc.documentElement.scrollHeight+'px';
    const out=[];for(const sh of doc.querySelectorAll('.sheet'))out.push(await window.html2canvas(sh,{scale:2,backgroundColor:'#ffffff',useCORS:true,windowWidth:794,width:794,height:1123}));
    return out;
  }finally{f.remove()}
}
async function shpPNG(d,opt){
  const cs=await shpCanvases(d,opt),w=cs[0].width,h=cs.reduce((a,c)=>a+c.height,0),c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);let y=0;cs.forEach(k=>{x.drawImage(k,0,y);y+=k.height});
  return new Promise(r=>c.toBlob(r,'image/png'));
}
async function shpPDF(d,opt){
  const cs=await shpCanvases(d,opt);await shpLoad(SHP_LIBS.pdf,()=>!!(window.jspdf&&window.jspdf.jsPDF));
  const doc=new window.jspdf.jsPDF({unit:'mm',format:'a4',orientation:'portrait'});
  cs.forEach((c,i)=>{if(i)doc.addPage();doc.addImage(c.toDataURL('image/jpeg',0.95),'JPEG',0,0,210,297)});
  return doc.output('blob');
}
function shpNoteSheet(s){
  const d=S.docs.find(x=>x.id===s.id);if(!d)return {title:'إذن تسليم',body:''};
  const hp=shpHasPrices(d);
  return {title:'إذن تسليم '+shpNo(d),body:'<div class="row sp" style="margin-bottom:10px;gap:8px;flex-wrap:wrap"><span class="row" style="gap:8px"><button class="btn pri" data-a="shpprint">طباعة</button><button class="btn" data-a="shppdf">PDF</button><button class="btn" data-a="shppng">صورة (PNG)</button><button class="btn" data-a="shpdl">HTML</button><button class="btn" data-a="shpxls">Excel</button></span>'+(hp?'<label class="row" style="gap:6px;font-size:13px"><input type="checkbox" data-c="shpprices" '+(s.prices?'checked':'')+'> اعرض الأسعار</label>':'')+'</div><p class="muted" style="font-size:12.5px;margin:0 0 10px">نسخة واحدة على A4، وفيها مكان توقيع مستلم الاستور وتوقيع أمين المخزن.</p><iframe class="notef" title="إذن التسليم" srcdoc="'+esc(shpNoteHTML(d,{prices:s.prices}))+'"></iframe>'};
}
/* ---------- delivery tracking inside the document ---------- */
function shpCard(d){
  if(d.status!=='done')return '';
  const dv=(d.hdr||{}).delivered,W=shpWhen(d);
  let h='<section class="card"><h2>التسليم للمحل</h2><div class="msg good" style="margin-bottom:10px">اتسجّل يوم <b>'+esc(W.date)+'</b> الساعة <b>'+esc(W.time)+'</b> · '+fmt(shpRows(d).reduce((a,r)=>a+r.q,0))+' قطعة خرجت من المخزن للمحل.</div>';
  h+='<div class="row" style="gap:8px;margin-bottom:12px"><button class="btn pri" data-a="shpnote" data-id="'+d.id+'">إذن التسليم (طباعة / تنزيل)</button></div>';
  if(dv)h+='<div class="msg good"><b>اتسلّم للمحل</b> '+esc(dv.date||'')+(dv.at?' · '+timeOf(dv.at):'')+(dv.receiver?' · استلمه '+esc(dv.receiver):'')+' · سجّله '+esc(dv.by||'')+'</div>';
  const has=!!PH[d.id],pm=d.photo||{name:'signed-note-'+d.no+'.jpg'};
  const photo='<div class="msg '+(dv||has?'good':'crit')+'" style="margin:'+(dv?'12px':'0')+' 0 10px"><b>'+(dv?'صورة الإذن الموقّع':'لسه ما اتسلّمش للمحل. الخطوة الأولى: صوّر الإذن بعد ما المحل يوقّع عليه')+'</b>'+(dv?'':'<br>الصورة <b>إجبارية</b>. من غيرها مش هتقدر تأكّد التسليم، لأنها الإثبات إن المحل استلم.')+'</div>'
    +(has?'<img src="'+PH[d.id]+'" alt="الإذن الموقّع" style="width:100%;max-width:420px;border-radius:10px;border:1px solid var(--line)"><div style="margin-top:6px">'+flBtn('ph:'+d.id,pm,'تنزيل صورة الإذن')+'</div>':'')
    +(dv?'':'<label class="f" style="margin-top:8px">'+(has?'تغيير صورة الإذن الموقّع':'ارفع صورة الإذن الموقّع (مطلوبة)')+'<input type="file" accept="image/*" data-c="photo"></label>');
  if(dv){h+='<div class="msg good"><b>اتسلّم للمحل</b> '+esc(dv.date||'')+(dv.at?' · '+timeOf(dv.at):'')+(dv.receiver?' · استلمه '+esc(dv.receiver):'')+' · سجّله '+esc(dv.by||'')+'</div>'+photo}
  else h+=photo+'<div class="msg warn" style="margin:14px 0 10px">'+(has?'الصورة اترفعت. راجعها، ولو الإذن واضح وعليه التوقيع اضغط "تم التسليم للمحل" للتأكيد. العملية دي بتتسجّل ومبتتعدّلش.':'زر "تم التسليم للمحل" مقفول لحد ما ترفع صورة الإذن الموقّع.')+'</div><div class="row" style="gap:8px;flex-wrap:wrap"><input data-c="shprecv" placeholder="اسم اللي استلم في المحل (اختياري)" value="'+esc(UI.shpRecv||'')+'" style="flex:1;min-width:200px"><button class="btn pri" data-a="shpdone" '+(has?'':'disabled aria-disabled="true"')+'>تم التسليم للمحل</button></div>';
  h+='</section>';
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
  shppdf:async()=>{const s=UI.sheet,d=S.docs.find(x=>x.id===(s||{}).id);if(!d)return;toast('بجهّز ملف الـ PDF…');try{const b=await shpPDF(d,{prices:s.prices});await saveFile('delivery-note-'+d.no+'.pdf',b,'اتنزّل ملف الـ PDF')}catch(e){toast('مقدرتش أجهّز الـ PDF (محتاج إنترنت). جرّب الـ HTML.')}},
  shppng:async()=>{const s=UI.sheet,d=S.docs.find(x=>x.id===(s||{}).id);if(!d)return;toast('بجهّز الصورة…');try{const b=await shpPNG(d,{prices:s.prices});await saveFile('delivery-note-'+d.no+'.png',b,'اتنزّلت الصورة')}catch(e){toast('مقدرتش أجهّز الصورة (محتاج إنترنت). جرّب الـ HTML.')}},
  shpdone:()=>{const d=curDoc();if(!d||d.status!=='done'||d.hdr.delivered)return;if(!PH[d.id]){toast('لازم ترفع صورة الإذن الموقّع الأول');return}d.hdr.delivered={at:Date.now(),date:S.date,by:S.actor,receiver:(UI.shpRecv||'').trim()};UI.shpRecv='';audit('تسليم '+d.no+' للمحل');dirty();toast('اتسجّل التسليم للمحل');render()}
};
const CHG_SH={
  shpprices:el=>{if(UI.sheet){UI.sheet.prices=el.checked;render()}}
};
const INP_SH={
  shprecv:el=>{UI.shpRecv=el.value},
  shpq:el=>{(UI.shp||(UI.shp={shop:'',st:'all',q:''})).q=el.value;const r=$('#shpres');if(r)r.innerHTML=shopListHTML(shopData());_L.main=null}
};
