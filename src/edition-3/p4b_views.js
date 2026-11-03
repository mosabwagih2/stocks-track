
/* ---------- STOCK ---------- */
function matrixHTML(m){
  const s=UI.s;let h='<div class="tw" style="padding:8px"><table class="mx"><thead><tr><th></th>'+m.sizes.map(z=>'<th>'+z+'</th>').join('')+'<th>إجمالي</th></tr></thead><tbody>';
  m.colors.forEach(c=>{
    h+='<tr><td class="cl">'+sw(c)+' '+esc(c)+'</td>';let rs=0;
    m.sizes.forEach(z=>{const id=IDX[m.code+'|'+c+'|'+z];if(!id){h+='<td></td>';return}
      const i=info(id),v=g(id,s.state);rs+=v;const cls=s.state==='READY'?(v<0?'c':i.cls):(v===0?'z':'');
      const tip=INTERNAL.filter(l=>g(id,l)).map(l=>LOC[l]+' '+g(id,l)).join(' · ')+(i.dm?'\nطلب مفتوح '+i.dm:'')+(i.cov!=null?'\nيغطّي '+Math.floor(i.cov)+' يوم':'');
      h+='<td><button class="cell '+(v===0&&!cls?'z':cls)+'" data-a="sku" data-sku="'+id+'" data-tip="'+esc(tip||'مفيش رصيد')+'" aria-label="'+esc(skuName(id))+': '+v+'">'+v+(s.state==='READY'&&i.dm?'<small>طلب '+i.dm+'</small>':'')+(s.state==='READY'&&g(id,'DIRTY')>0?'<i class="dy"></i>':'')+'</button></td>';});
    h+='<td class="num"><b class="n">'+fmt(rs)+'</b></td></tr>';
  });
  return h+'</tbody></table></div>';
}
const matrixLegend='<div class="legend" style="margin-top:10px"><span><i class="dot" style="background:var(--crit)"></i>الطلب أكبر من الجاهز</span><span><i class="dot" style="background:var(--warn)"></i>قرب يخلص</span><span><i class="dot" style="background:var(--c-dirty)"></i>فيه هالك نظافة</span></div>';
function modelHead(m){return '<div class="row sp" style="margin-bottom:12px"><div class="row" style="flex-wrap:nowrap;gap:14px"><button class="imgbtn" data-a="img" data-m="'+m.code+'" aria-label="صورة '+m.code+'" data-tip="اضغط لعرض الصورة أو تغييرها">'+thumb(m.code,64)+'</button><div><h2 style="margin:0">'+esc(mName(m.code))+'</h2><span class="muted">'+LOC[UI.s.state]+': <b class="n">'+fmt(mSum(m.code,UI.s.state))+'</b> قطعة · طلب مفتوح <span class="n">'+fmt(D.skus.reduce((a,k)=>a+(k.m===m.code?(ctx().demand[k.id]||0):0),0))+'</span></span></div></div>'+pill('',ctx().abc[m.code]?'فئة '+ctx().abc[m.code]+' (حسب السحب)':'مفيش سحب')+'</div>'}
function ordM(){const hm=ctx().hm;return UI.s.sort==='alpha'?MORDER.slice():MORDER.slice().sort((a,b)=>(hm[b]||0)-(hm[a]||0)||mIdx[a]-mIdx[b])}
function vStock(){
  const s=UI.s,m=MODEL.get(s.m)||MODEL.get(MORDER[0]);
  const tools='<div class="seg"><button aria-pressed="'+(s.view==='matrix')+'" data-a="sview" data-v="matrix">موديل واحد</button><button aria-pressed="'+(s.view==='all')+'" data-a="sview" data-v="all">كل الموديلات</button><button aria-pressed="'+(s.view==='table')+'" data-a="sview" data-v="table">كل الأصناف</button></div>';
  let h=top('المخزون','كل صنف (موديل × لون × مقاس) وحالته. اضغط أي خانة تفتح تفاصيلها.',tools);
  h+='<div class="chips" style="margin-bottom:14px">'+INTERNAL.map(l=>'<button class="chip" aria-pressed="'+(s.state===l)+'" data-a="sstate" data-v="'+l+'"><i class="dot" style="background:'+LCOL[l]+'"></i>'+LOC[l]+' <span class="n">'+fmt(locSum(l))+'</span></button>').join('')+'</div>';
  if(s.view==='table'){
    h+='<div class="row" style="margin-bottom:12px"><div class="chips">'+[['all','الكل'],['low','قرب يخلص'],['neg','بالسالب'],['dem','عليه طلب مفتوح']].map(f=>'<button class="chip" aria-pressed="'+((s.flt||'all')===f[0])+'" data-a="sflt" data-v="'+f[0]+'">'+f[1]+'</button>').join('')+'</div><input type="search" id="sq" placeholder="ابحث: BR2 احمر L" value="'+esc(s.q)+'" data-c="sq" style="flex:1;min-width:200px;max-width:340px"></div><div id="stres">'+stockTable()+'</div>';
    return h;
  }
  const groups={},OM=ordM();OM.forEach(c=>{(groups[lineOf(c)]||(groups[lineOf(c)]=[])).push(c)});
  const sortBtn='<div class="seg" role="group" aria-label="الترتيب"><button aria-pressed="'+(s.sort!=='alpha')+'" data-a="ssort" data-v="pull">الأكتر سحبًا</button><button aria-pressed="'+(s.sort==='alpha')+'" data-a="ssort" data-v="alpha">أبجدي</button></div>';
  if(s.view==='all'){
    const L=s.line||'all',ms=OM.filter(c=>L==='all'||lineOf(c)===L);
    h+='<div class="row" style="margin-bottom:14px"><div class="chips">'+[['all','كل الموديلات']].concat(LINE_ORDER.filter(l=>groups[l]).map(l=>[l,l])).map(f=>'<button class="chip" aria-pressed="'+(L===f[0])+'" data-a="sline" data-v="'+f[0]+'">'+f[1]+'</button>').join('')+'</div>'+sortBtn+'</div>';
    h+='<div class="stack">'+ms.map(c=>'<section class="card">'+modelHead(MODEL.get(c))+matrixHTML(MODEL.get(c))+'</section>').join('')+'</div>'+matrixLegend;
    return h;
  }
  const showList=s.list!==false;
  h+='<div class="row" style="margin-bottom:12px">'+sortBtn+'<button class="btn sm" data-a="slist" aria-pressed="'+showList+'">'+(showList?'إخفاء قايمة الموديلات':'إظهار قايمة الموديلات')+'</button>'+(showList?'':'<select data-c="smsel" aria-label="الموديل">'+OM.map(c=>'<option value="'+c+'" '+(c===s.m?'selected':'')+'>'+c+' · '+esc(MODEL.get(c).name)+(ctx().hm[c]?' ('+ctx().hm[c]+' قطعة مطلوبة)':'')+'</option>').join('')+'</select>')+'</div>';
  h+='<div class="'+(showList?'wh':'')+'">';
  if(showList)h+='<nav class="card flat mlist" aria-label="الموديلات">'+LINE_ORDER.filter(l=>groups[l]).map(l=>'<div class="mgrp">'+l+'</div>'+groups[l].map(c=>{const r=mSum(c,'READY'),low=D.skus.some(k=>k.m===c&&info(k.id).cls==='c');
    return '<button class="mi" aria-current="'+(c===s.m)+'" data-a="smodel" data-m="'+c+'">'+thumb(c,34)+'<b>'+c+'</b><small>'+esc(MODEL.get(c).name)+'</small><span class="n">'+(low?'<i class="dot" style="background:var(--c-scrap)"></i> ':'')+fmt(s.state==='READY'?r:mSum(c,s.state))+'</span></button>'}).join('')).join('')+'</nav>';
  h+='<section class="card">'+modelHead(m)+matrixHTML(m)+matrixLegend+'</section></div>';
  return h;
}
function stockTable(){
  const s=UI.s,q=s.q.trim().toLowerCase().split(/\s+/).filter(Boolean),f=s.flt||'all',C=ctx();
  let rows=D.skus.filter(k=>{
    const i=info(k.id);if(f==='low'&&!i.cls)return false;if(f==='neg'&&g(k.id,'READY')>=0)return false;if(f==='dem'&&!i.dm)return false;
    if(q.length){const hay=(k.id+' '+k.c+' '+k.s+' '+MODEL.get(k.m).name).toLowerCase();if(!q.every(w=>hay.indexOf(w)>=0))return false}
    return true;
  }).map(k=>k.id);
  rows.sort((a,b)=>{const x=info(a),y=info(b),rx=x.cls==='c'?0:x.cls==='w'?1:2,ry=y.cls==='c'?0:y.cls==='w'?1:2;return rx-ry||skuSort(a,b)});
  const tot=rows.length;rows=rows.slice(0,200);
  if(!rows.length)return '<div class="card"><div class="empty">مفيش أصناف بالفلتر ده.</div></div>';
  return '<div class="tw"><table class="t-sm"><thead><tr><th>الصنف</th><th class="num">جاهز</th><th class="num">هالك نظافة</th><th class="num">عند المصنع</th><th class="num">مفقود</th><th class="num">طلب مفتوح</th><th class="num">يغطّي (يوم)</th><th></th></tr></thead><tbody>'+rows.map(id=>{const i=info(id),k=SKU.get(id);
    return '<tr data-a="sku" data-sku="'+id+'"><td>'+thumb(k.m,26)+' '+sw(k.c)+' <b class="mono">'+k.m+'</b> '+esc(k.c)+' · '+k.s+'</td><td class="num">'+N(i.R)+'</td><td class="num">'+N(g(id,'DIRTY'))+'</td><td class="num">'+N(g(id,'FACTORY'))+'</td><td class="num">'+N(g(id,'LOST'))+'</td><td class="num">'+N(i.dm)+'</td><td class="num">'+(i.cov!=null?'<span class="n">'+Math.floor(i.cov)+'</span>':'—')+'</td><td>'+(i.R<0?pill('crit','بالسالب'):i.cls==='c'?pill('crit','هيخلص'):i.cls==='w'?pill('warn','قرب'):'')+'</td></tr>'}).join('')+'</tbody></table></div>'+(tot>200?'<p class="muted" style="margin-top:8px">أول 200 من '+fmt(tot)+'. ضيّق البحث.</p>':'');
}

/* ---------- OPERATIONS ---------- */
function vOps(){
  const d=S.docs.find(x=>x.id===UI.doc);if(d)return vDoc(d);
  let h=top('العمليات','كل حاجة بتغيّر المخزون بتتسجل هنا. اختار اللي عملته.','');
  ['دخول','خروج','داخلي','رقابة'].forEach(g_=>{
    h+='<div class="gh">'+g_+'</div><div class="opgrid" style="margin-bottom:12px">'+OPS_LIST.filter(t=>OT[t].grp===g_).map(t=>'<button class="op" data-a="newop" data-t="'+t+'"><span class="ic">'+ic(OT[t].ic)+'</span><b>'+OT[t].ar+'</b><small>'+OT[t].d+'</small><em>'+OT[t].en+'</em></button>').join('')+'</div>';
  });
  const F=[['all','الكل'],['draft','مسودة'],['done','مؤكدة'],['reversed','معكوسة']],docs=S.docs.filter(x=>UI.opF==='all'||x.status===UI.opF).slice().reverse();
  h+='<div class="row sp" style="margin:20px 0 10px"><h2 style="font-size:17px">آخر العمليات</h2><div class="chips">'+F.map(f=>'<button class="chip" aria-pressed="'+(UI.opF===f[0])+'" data-a="opf" data-v="'+f[0]+'">'+f[1]+'</button>').join('')+'</div></div>';
  h+=docs.length?'<div class="tw"><table><thead><tr><th>الرقم</th><th>العملية</th><th>التاريخ</th><th class="num">حركات</th><th>اتعملت بواسطة</th><th>الحالة</th></tr></thead><tbody>'+docs.slice(0,60).map(x=>'<tr data-a="opendoc" data-id="'+x.id+'"><td class="mono">'+(x.no||'مسودة')+'</td><td>'+OT[x.type].ar+' <span class="muted" style="font-size:12px">'+OT[x.type].en+'</span></td><td class="mono">'+x.date+'</td><td class="num">'+N(x.nMoves||0)+'</td><td>'+esc(x.hdr.emp||x.by)+'</td><td>'+(x.status==='done'?pill('good','مؤكدة'):x.status==='draft'?pill('warn','مسودة'):pill('','معكوسة'))+'</td></tr>').join('')+'</tbody></table></div>':'<div class="card"><div class="empty">لسه مفيش عمليات. ابدأ من الكروت اللي فوق. الرصيد الافتتاحي ظاهر في سجل الحركات.</div></div>';
  return h;
}
function picker(d){
  const m=UI.pk.m,mm=MODEL.get(m);
  const src=srcLoc(d);
  return '<div class="picker"><label class="f">الموديل<select id="pkm" data-c="pkm">'+MORDER.map(c=>'<option value="'+c+'" '+(c===m?'selected':'')+'>'+c+' · '+esc(MODEL.get(c).name)+'</option>').join('')+'</select></label><label class="f">اللون<select id="pkc">'+mm.colors.map(c=>'<option>'+esc(c)+'</option>').join('')+'</select></label><label class="f">المقاس<select id="pks">'+mm.sizes.map(c=>'<option>'+c+'</option>').join('')+'</select></label><label class="f">الكمية<span class="stp"><button type="button" data-a="pq" data-d="-1">−</button><input type="number" id="pkq" min="1" value="1"><button type="button" data-a="pq" data-d="1">+</button></span></label><button class="btn pri" data-a="addline" style="align-self:flex-end">إضافة</button></div><div class="muted" id="pkhint" style="font-size:12px;margin-top:6px">'+pkHint(src)+'</div>';
}
function pkHint(src){
  const m=UI.pk.m,mm=MODEL.get(m),c=(($('#pkc')||{}).value)||mm.colors[0],z=(($('#pks')||{}).value)||mm.sizes[0],id=IDX[m+'|'+c+'|'+z];
  return id?thumb(m,40)+' '+(src?'المتاح في '+LOC[src]+': <b class="n">'+g(id,src)+'</b>':'جاهز حاليًا: <b class="n">'+g(id,'READY')+'</b>'):'';
}
function lineTable(d){
  if(!d.lines.length)return '<div class="empty">لسه مفيش أصناف. اختار الموديل واللون والمقاس وأضف.</div>';
  const ro=d.status!=='draft',src=srcLoc(d);
  let head='',row=null;
  if(d.type==='RTN'){head='<th>الصنف</th><th class="num">متوقع</th><th class="num">رجع سليم</th><th class="num">هالك نظافة</th><th class="num">هالك نهائي</th><th class="num">ناقص</th><th></th>';
    row=(l,i)=>{const got=num(l.r)+num(l.d)+num(l.x),sh=num(l.exp)-got;return '<td>'+esc(skuName(l.sku))+'</td><td class="num">'+N(l.exp)+'</td>'+['r','d','x'].map(f=>'<td class="num"><input type="number" min="0" value="'+l[f]+'" data-c="ln" data-i="'+i+'" data-f="'+f+'" '+(ro?'disabled':'')+'></td>').join('')+'<td class="num" data-sync="sh'+i+'">'+(sh>0?pill('crit',sh):sh<0?pill('warn','+'+(-sh)):'<span class="muted">0</span>')+'</td>'}}
  else if(d.type==='FRC'){head='<th>الصنف</th><th class="num">عند المصنع</th><th class="num">رجع سليم</th><th class="num">مرفوض</th><th></th>';row=(l,i)=>'<td>'+esc(skuName(l.sku))+'</td><td class="num">'+N(g(l.sku,'FACTORY'))+'</td><td class="num">'+(ro?N(l.q):stp(i,l.q,'q'))+'</td><td class="num"><input type="number" min="0" value="'+l.rej+'" data-c="ln" data-i="'+i+'" data-f="rej" '+(ro?'disabled':'')+'></td>'}
  else if(d.type==='LOS'){head='<th>الصنف</th><th class="num">مفقود</th><th class="num">الكمية</th><th>القرار</th><th></th>';row=(l,i)=>'<td>'+esc(skuName(l.sku))+'</td><td class="num">'+N(g(l.sku,'LOST'))+'</td><td class="num">'+(ro?N(l.q):stp(i,l.q,'q'))+'</td><td><select data-c="lres" data-i="'+i+'" '+(ro?'disabled':'')+'><option value="FOUND" '+(l.res==='FOUND'?'selected':'')+'>لقيناه (يرجع جاهز)</option><option value="OFF" '+(l.res==='OFF'?'selected':'')+'>شطب نهائي</option></select></td>'}
  else{head='<th>الصنف</th>'+(src?'<th class="num">المتاح في '+LOC[src]+'</th>':'')+'<th class="num">الكمية</th><th></th>';row=(l,i)=>'<td>'+esc(skuName(l.sku))+'</td>'+(src?'<td class="num">'+N(g(l.sku,src))+'</td>':'')+'<td class="num">'+(ro?N(l.q):stp(i,l.q,'q'))+'</td>'}
  return '<div class="tw"><table class="t-sm"><thead><tr>'+head+'</tr></thead><tbody>'+d.lines.map((l,i)=>'<tr>'+row(l,i)+'<td>'+(ro?'':'<button class="btn sm ghost danger" data-a="rmline" data-i="'+i+'" aria-label="حذف">حذف</button>')+'</td></tr>').join('')+'</tbody></table></div>';
}
function cntGrid(d){
  const H=d.hdr;
  if(!H.started)return '<div class="msg">اختار الموديلات اللي هتتجرد وبعدين اضغط "ابدأ الجرد". الرصيد الحالي مخفي عنك عشان العدّ يبقى أمين.</div>';
  return H.models.map(c=>{const m=MODEL.get(c);return '<div style="margin-top:14px"><h3 style="font-size:15px;margin-bottom:6px">'+esc(mName(c))+'</h3><div class="tw" style="padding:6px"><table class="mx"><thead><tr><th></th>'+m.sizes.map(z=>'<th>'+z+'</th>').join('')+'</tr></thead><tbody>'+m.colors.map(col=>'<tr><td class="cl">'+sw(col)+' '+esc(col)+'</td>'+m.sizes.map(z=>{const id=IDX[c+'|'+col+'|'+z];if(!id)return '<td></td>';const v=H.cnt[id],now=g(id,H.state),diff=(v===''||v==null)?null:num(v)-now;
    return '<td style="text-align:center"><input type="number" min="0" value="'+(v==null?'':v)+'" data-c="cnt" data-sku="'+id+'" style="width:64px" '+(d.status!=='draft'?'disabled':'')+'>'+(H.reveal&&diff!=null?'<div style="font:500 11px var(--f-mono);color:'+(diff===0?'var(--muted)':diff<0?'var(--crit)':'var(--good)')+'">'+(diff===0?'مطابق':(diff>0?'+':'')+diff)+' <span class="muted">(سيستم '+now+')</span></div>':'')+'</td>'}).join('')+'</tr>').join('')+'</tbody></table></div></div>'}).join('');
}
function vDoc(d){
  const T=OT[d.type],H=d.hdr,draft=d.status==='draft',r=draft?build(d):null;
  let h='<div class="row" style="margin-bottom:6px"><button class="btn sm ghost" data-a="backops">← كل العمليات</button></div>';
  h+=top(T.ar+' <span class="pill" style="font-size:12px;vertical-align:middle">'+T.en+'</span>',d.no?'رقم <span class="mono">'+d.no+'</span> · '+d.date:'مسودة. مفيش حاجة اتغيّرت في المخزون لسه.','<span>'+(d.status==='done'?pill('good','مؤكدة'):d.status==='reversed'?pill('','معكوسة'):pill('warn','مسودة'))+'</span>');
  h+='<div class="grid split2"><div class="stack"><section class="card">';
  // header fields
  h+='<h2>البيانات</h2><div class="grid g2">';
  h+='<label class="f">التاريخ<input type="date" value="'+d.date+'" data-c="hdate" '+(draft?'':'disabled')+'></label>';
  const dis=draft?'':'disabled';
  if(d.type==='RCV')h+='<label class="f">رقم الإذن / الورقة<input value="'+esc(H.ref)+'" data-c="h" data-f="ref" '+dis+'></label><label class="f">إجمالي القطع المكتوب في الورقة<input type="number" min="0" value="'+esc(H.declared)+'" data-c="h" data-f="declared" '+dis+'></label>';
  if(d.type==='SHP')h+='<label class="f">ملاحظة<input value="'+esc(H.note)+'" data-c="h" data-f="note" '+dis+'></label>';
  if(d.type==='CLN')h+='<label class="f">من حالة<select data-c="clnfrom" '+dis+'><option value="READY" '+(H.from==='READY'?'selected':'')+'>جاهز للبيع</option><option value="DIRTY" '+(H.from==='DIRTY'?'selected':'')+'>هالك نظافة</option></select></label><label class="f">إلى حالة<select data-c="h" data-f="to" '+dis+'>'+(H.from==='READY'?'<option value="DIRTY" '+(H.to==='DIRTY'?'selected':'')+'>هالك نظافة (ينفع يتغسل)</option>':'')+'<option value="SCRAP" '+(H.to==='SCRAP'?'selected':'')+'>هالك نهائي (مفيش علاج)</option></select></label><label class="f" style="grid-column:1/-1">السبب (اختياري)<input value="'+esc(H.reason)+'" data-c="h" data-f="reason" placeholder="مثلًا: بقعة، خيط مقطوع" '+dis+'></label>';
  if(d.type==='FSD')h+='<label class="f" style="grid-column:1/-1">نوع الإرسال<select data-c="fsdkind" '+dis+'><option value="wash" '+(H.kind==='wash'?'selected':'')+'>غسيل مجاني (من هالك نظافة، وهيرجع)</option><option value="waste" '+(H.kind==='waste'?'selected':'')+'>تسليم هالك للمصنع (من هالك نهائي، وبيخرج)</option></select></label>';
  if(d.type==='RTN')h+='<label class="f">القناة<select data-c="h" data-f="channel" '+dis+'>'+CHAN.map(c=>'<option value="'+c.id+'" '+(H.channel===c.id?'selected':'')+'>'+c.name+'</option>').join('')+'</select></label>';
  if(d.type==='CNT')h+='<label class="f">الحالة اللي بتتعدّ<select data-c="cntstate" '+(draft&&!H.started?'':'disabled')+'>'+['READY','DIRTY'].map(l=>'<option value="'+l+'" '+(H.state===l?'selected':'')+'>'+LOC[l]+'</option>').join('')+'</select></label>';
  if(d.type==='SCN')h+='<div class="kpi"><small>الموظف</small><b style="font-size:18px;font-family:var(--f-ar)">'+esc(H.emp)+'</b></div><div class="kpi"><small>المصدر</small><b style="font-size:15px;font-family:var(--f-ar)">'+esc(H.src)+'</b></div>';
  h+='</div>';
  if(draft&&(d.type==='RCV'||d.type==='SHP'))h+='<div style="margin-top:12px"><label class="f">صورة الورقة الموقّعة من الطرفين<input type="file" accept="image/*" data-c="photo"></label>'+(PH[d.id]?'<img src="'+PH[d.id]+'" alt="الورقة" style="margin-top:8px;max-height:140px;border-radius:10px;border:1px solid var(--line)">':'')+'</div>';
  h+='</section>';
  if(d.type==='RTN'&&draft)h+='<section class="card"><h2>المتوقع رجوعه</h2><label class="f">أكواد الأوردرات المرتجعة (لو الشيت فيه أكواد)<textarea data-c="rtncodes" placeholder="كود في كل سطر">'+esc(H.codes)+'</textarea></label><div class="row" style="margin-top:8px"><button class="btn sm" data-a="rtnfill">املا المتوقع من الأكواد</button><span class="muted" style="font-size:12px">بيدوّر في الأوردرات اللي اتسكانت بس. أو ضيف الأصناف يدويًا تحت.</span></div>'+(H.unk&&H.unk.length?'<div class="msg warn" style="margin-top:8px">أكواد مش متسكّنة أو مش موجودة: <span class="mono">'+H.unk.slice(0,10).map(esc).join('، ')+'</span></div>':'')+'</section>';
  if(d.type==='CNT'){
    h+='<section class="card"><h2>الجرد</h2>';
    if(draft&&!H.started){h+='<div class="chips" style="margin-bottom:10px">'+MORDER.map(c=>'<button class="chip" aria-pressed="'+(H.models.indexOf(c)>=0)+'" data-a="cntm" data-m="'+c+'">'+c+'</button>').join('')+'</div><button class="btn pri" data-a="cntstart" '+(H.models.length?'':'disabled')+'>ابدأ الجرد ('+H.models.length+' موديل)</button>'}
    h+=cntGrid(d)+'</section>';
  }else if(d.type==='SCN'){
    const refs=H.refs;h+='<section class="card"><h2>الأوردرات ('+refs.length+')</h2><div class="tw"><table class="t-sm"><thead><tr><th>الكود</th><th class="num">قطع</th><th>الحالة</th></tr></thead><tbody>'+refs.map(rf=>{const o=orderByRef(rf);return '<tr data-a="order" data-ref="'+esc(rf)+'"><td class="mono">'+esc(rf)+'</td><td class="num">'+N(o?o.lines.length:0)+'</td><td>'+(o?ordPill(o):'')+'</td></tr>'}).join('')+'</tbody></table></div></section>';
    h+='<section class="card"><h2>الخارج حسب الصنف</h2>'+lineTable({lines:scnLines(d),status:'done',type:'SCN',hdr:H,id:d.id})+'</section>';
  }else{
    h+='<section class="card"><h2>الأصناف</h2>'+(draft?picker(d)+'<div style="height:12px"></div>':'')+lineTable(d)+'</section>';
  }
  h+='</div><aside class="sum">';
  if(draft){
    const eff=effects(r.mv);
    h+='<section class="card lift"><h2>قبل ما تأكّد</h2><div class="chk">'+r.checks.map(c=>'<div class="'+(c.ok?'ok':'no')+'"><span>'+c.t+'</span></div>').join('')+'</div>';
    if(r.err.length)h+='<div class="msg crit" style="margin-top:12px"><b>مش هينفع:</b><ul>'+r.err.slice(0,6).map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul></div>';
    if(r.warn.length)h+='<div class="msg warn" style="margin-top:12px"><ul style="margin:0">'+r.warn.slice(0,5).map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul></div>';
    if(d.type==='RTN')h+='<label class="row" style="margin-top:12px;gap:8px"><input type="checkbox" data-c="rtncounted" '+(H.counted?'checked':'')+'> خلّصت عدّ كل الأصناف</label>';
    if(d.type==='CNT'&&H.started){h+='<div class="row" style="margin-top:12px"><button class="btn sm" data-a="cntreveal">اكشف الفروق</button>';
      if(H.reveal&&r.checks.some(c=>!c.ok&&/اتغيّر/.test(c.t)))h+='<label class="row" style="gap:8px"><input type="checkbox" data-c="cntack" '+(H.ack?'checked':'')+'> موافق</label>';h+='</div>'}
    h+='<div style="margin-top:14px" class="row"><button class="btn pri" data-a="confirm" '+(r.ok?'':'disabled')+'>تأكيد وتسجيل '+fmt(r.mv.reduce((a,m)=>a+m.q,0))+' قطعة</button><button class="btn danger sm" data-a="deldoc">حذف المسودة</button></div></section>';
    h+='<section class="card"><h2>اللي هيتغيّر <span class="hint">'+eff.length+' صنف</span></h2>'+(eff.length?'<div class="eff">'+eff.slice(0,40).map(e=>'<div class="e"><div class="t"><span>'+esc(skuName(e.sku))+'</span></div>'+e.ch.map(c=>'<div class="chg">'+LOC[c.l]+': دلوقتي <b>'+c.now+'</b> · هيبقى <b>'+c.after+'</b></div>').join('')+'</div>').join('')+'</div>':'<div class="empty">هيظهر هنا أثر العملية على كل صنف قبل التأكيد.</div>')+'</section>';
  }else{
    h+='<section class="card"><h2>الحالة</h2>'+(d.status==='done'?'<div class="msg good">اتأكدت وسجّلت '+d.nMoves+' حركة.</div>':'<div class="msg">العملية اتعكست.</div>')+(d.status==='done'?'<div style="margin-top:12px"><button class="btn danger sm" data-a="reverse">عكس العملية</button><div class="muted" style="font-size:12px;margin-top:6px">بتسجّل حركة عكسية. السجل الأصلي بيفضل زي ما هو.</div></div>':'')+(UI.msg?'<div class="msg crit" style="margin-top:12px">'+UI.msg+'</div>':'')+'</section>';
    h+='<section class="card"><h2>السجل</h2><div class="queue">'+d.log.slice().reverse().map(l=>'<div class="muted" style="font-size:13px"><span class="mono">'+timeOf(l.t)+'</span> · '+esc(l.by)+': '+esc(l.m)+'</div>').join('')+'</div></section>';
  }
  return h+'</aside></div>';
}

