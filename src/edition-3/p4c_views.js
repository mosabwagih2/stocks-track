
/* ---------- INSIGHTS ---------- */
function planRows(){
  const C=ctx(),rows=[];
  lowList().forEach(x=>{const id=x[0],i=x[1],k=SKU.get(id),pend=g(id,'FACTORY'),have=i.R-i.dm+pend,target=C.velOK?Math.ceil(i.v*S.st.target):Math.max((k.min||0)*2,i.dm),q=Math.max(0,target-have);if(q>0)rows.push({id,q,i,pend})});
  return rows;
}
/* ---------- LEDGER ---------- */
function vLedger(){
  const L=UI.led;let h=top('سجل الحركات','كل حركة اتسجلت. مفيش حاجة بتتعدّل أو بتتمسح، والتصحيح بحركة عكسية.','');
  h+='<div class="tabs" role="tablist"><button role="tab" aria-selected="'+(L.tab==='moves')+'" data-a="ltab" data-v="moves">الحركات</button><button role="tab" aria-selected="'+(L.tab==='audit')+'" data-a="ltab" data-v="audit">مين عمل إيه</button></div>';
  if(L.tab==='audit'){
    const ev=[];S.docs.forEach(d=>d.log.forEach(l=>ev.push({t:l.t,by:l.by,m:OT[d.type].ar+' '+(d.no||'مسودة')+': '+l.m})));
    S.orders.forEach(o=>{if(o.sc)ev.push({t:o.sc.at,by:o.sc.by,m:'شحن أوردر '+o.ref});if(o.cx)ev.push({t:o.cx.at,by:o.cx.by,m:'إلغاء أوردر '+o.ref+(o.cx.reason?': '+o.cx.reason:'')})});
    ev.sort((a,b)=>b.t-a.t);
    return h+(ev.length?'<div class="tw"><table class="t-sm"><thead><tr><th>الوقت</th><th>الموظف</th><th>الإجراء</th></tr></thead><tbody>'+ev.slice(0,150).map(e=>'<tr><td class="mono muted">'+new Date(e.t).toLocaleString('en-GB',{timeZone:'Africa/Cairo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+'</td><td>'+esc(e.by)+'</td><td>'+esc(e.m)+'</td></tr>').join('')+'</tbody></table></div>':'<div class="card"><div class="empty">لسه مفيش إجراءات.</div></div>');
  }
  h+='<div class="row" style="margin-bottom:12px"><input type="search" id="lq" placeholder="ابحث بالصنف: BR2 احمر" value="'+esc(L.q)+'" data-c="lq" style="min-width:200px;max-width:320px;flex:1"><select data-c="ltype"><option value="">كل الأنواع</option>'+Object.keys(OT).map(t=>'<option value="'+t+'" '+(L.type===t?'selected':'')+'>'+OT[t].ar+'</option>').join('')+'</select></div><div id="ledres">'+ledRows()+'</div>';
  return h;
}
function ledRows(){
  const L=UI.led,q=L.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows=S.moves.filter(m=>{if(L.type&&m.type!==L.type)return false;if(q.length){const hay=(m.sku+' '+SKU.get(m.sku).c+' '+m.doc).toLowerCase();if(!q.every(w=>hay.indexOf(w)>=0))return false}return true});
  const shown=rows.slice(-L.n).reverse();
  return '<div class="tw"><table class="t-sm"><thead><tr><th>التاريخ</th><th>المستند</th><th>الصنف</th><th class="num">كمية</th><th>من</th><th>إلى</th><th>ملاحظة</th></tr></thead><tbody>'+shown.map(m=>'<tr><td class="mono">'+esc(m.date)+'</td><td class="mono">'+esc(m.doc)+'</td><td>'+esc(skuName(m.sku))+'</td><td class="num mono">'+m.q+'</td><td>'+esc(LOC[m.from])+'</td><td>'+esc(LOC[m.to])+'</td><td class="muted">'+esc(m.note||'')+'</td></tr>').join('')+'</tbody></table></div><p class="muted" style="margin-top:8px">'+fmt(rows.length)+' حركة'+(rows.length>L.n?' (آخر '+L.n+')':'')+'</p>';
}

/* ---------- CONFIG ---------- */
function vConfig(){
  const stf=(f,l,u)=>'<label class="f">'+l+'<span class="row" style="gap:6px"><input type="number" min="0" value="'+S.st[f]+'" data-c="st" data-f="'+f+'">'+(u?'<span class="muted">'+u+'</span>':'')+'</span></label>';
  let h=top('الإعدادات','حدود التنبيه وقواعد المستلزمات والتكلفة.','');
  h+='<div class="grid g2"><section class="card"><h2>التنبيهات</h2><div class="grid g2">'+stf('lookback','فترة حساب السحب','يوم')+stf('cover','نبّهني لما التغطية أقل من','يوم')+stf('target','هدف التصنيع','يوم تغطية')+stf('excess','زيادة عن اللازم بعد','يوم')+'</div></section>';
  h+='<section class="card"><h2>المستلزمات</h2><p class="muted" style="margin-bottom:10px">الاسم والوحدة والعبوة وحد التنبيه وقاعدة الخصم التلقائي لكل مستلزم. الاستلام والصرف والجرد من صفحة المستلزمات.</p><div class="tw"><table class="t-sm"><tbody>'+S.sup.items.map(i=>'<tr style="'+(i.arch?'opacity:.6':'')+'"><td><b>'+esc(i.name)+'</b>'+(i.arch?' '+pill('','مؤرشف'):'')+'</td><td class="muted">'+esc(ruleText(i))+'</td><td>'+(i.arch?'<button class="btn sm" data-a="suprestore" data-id="'+i.id+'">استرجاع</button>':'<button class="btn sm" data-a="supconf" data-id="'+i.id+'">تعديل</button>')+'</td></tr>').join('')+'</tbody></table></div><div class="row" style="margin-top:10px"><button class="btn sm" data-a="supnew">+ إضافة مستلزم</button><button class="btn sm ghost" data-a="go" data-t="supplies">افتح صفحة المستلزمات</button></div></section>';
  h+='<section class="card"><h2>المستخدمين</h2><label class="f">اسم المستخدم الحالي (يظهر في السجل)<input value="'+esc(S.actor)+'" data-c="actor"></label><p class="muted" style="margin-top:8px;font-size:12px">السيستم مفتوح للكل في فترة التجربة. الصلاحيات هتتفصل بعدين على مستويين بس.</p></section>';
  h+='<section class="card"><h2>البيانات</h2><p class="muted" style="margin-bottom:10px">البيانات متخزنة في المتصفح ده بس. ده نموذج تجريبي.</p>'+(UI.confirmReset?'<div class="msg crit">هتمسح كل العمليات والسكان وترجع للبيانات الأصلية. متأكد؟<div class="row" style="margin-top:8px"><button class="btn danger sm" data-a="reset2">أيوه، امسح</button><button class="btn sm" data-a="reset">لأ</button></div></div>':'<button class="btn danger" data-a="reset">رجوع للبيانات الأصلية</button>')+'</section></div>';
  h+='<section class="card" style="margin-top:16px"><h2>التكلفة وسعر البيع <span class="hint">اختياري. بتحسب قيمة المخزون</span></h2><div class="tw" style="max-height:340px;overflow:auto"><table class="t-sm"><thead><tr><th>الموديل</th><th class="num">تكلفة القطعة (ج)</th><th class="num">سعر البيع (ج)</th><th class="num">هامش</th></tr></thead><tbody>'+MORDER.map(m=>{const c=S.costs[m]||{},mg=(+c.cost&&+c.price)?Math.round((c.price-c.cost)/c.price*100)+'%':'—';return '<tr><td><b class="mono">'+m+'</b> <span class="muted">'+esc(MODEL.get(m).name)+'</span></td><td class="num"><input type="number" min="0" value="'+(c.cost||'')+'" data-c="cost" data-m="'+m+'" data-f="cost"></td><td class="num"><input type="number" min="0" value="'+(c.price||'')+'" data-c="cost" data-m="'+m+'" data-f="price"></td><td class="num">'+mg+'</td></tr>'}).join('')+'</tbody></table></div></section>';
  return h;
}
