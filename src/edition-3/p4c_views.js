
/* ---------- INSIGHTS ---------- */
function planRows(){
  const C=ctx(),rows=[];
  lowList().forEach(x=>{const id=x[0],i=x[1],k=SKU.get(id),pend=g(id,'FACTORY'),have=i.R-i.dm+pend,target=C.velOK?Math.ceil(i.v*S.st.target):Math.max((k.min||0)*2,i.dm),q=Math.max(0,target-have);if(q>0)rows.push({id,q,i,pend})});
  return rows;
}
function vInsights(){
  const C=ctx(),T=[['plan','اقتراح التصنيع'],['demand','الطلب'],['kits','الباندلز'],['team','الفريق'],['health','صحة المخزون']];
  let h=top('التحليلات','قرارات مبنية على الطلب الفعلي: إيه نصنّع، إيه بيتباع، مين شغال.','');
  h+='<div class="tabs" role="tablist">'+T.map(t=>'<button role="tab" aria-selected="'+(UI.ins===t[0])+'" data-a="instab" data-v="'+t[0]+'">'+t[1]+'</button>').join('')+'</div>';
  if(!C.velOK)h+='<div class="msg warn" style="margin-bottom:14px">عندنا '+C.days+' يوم بيانات بس. سرعة السحب مش مضمونة قبل 3 أيام، فالتنبيهات مبنية على الحد الأدنى القديم.</div>';
  if(UI.ins==='plan'){
    const rows=planRows(),by={};rows.forEach(r=>{(by[SKU.get(r.id).m]||(by[SKU.get(r.id).m]=[])).push(r)});
    const ms=Object.keys(by).sort((a,b)=>by[b].reduce((x,r)=>x+r.q,0)-by[a].reduce((x,r)=>x+r.q,0)),tot=rows.reduce((a,r)=>a+r.q,0);
    h+='<div class="kpis" style="margin-bottom:14px">'+kpi('أصناف محتاجة تصنيع',N(rows.length),'')+kpi('إجمالي مقترح',N(tot),'قطعة')+kpi('الهدف',N(S.st.target),'يوم تغطية')+'</div>';
    if(!rows.length)return h+'<div class="card"><div class="empty">مفيش أصناف تحت الحد حاليًا.</div></div>';
    h+='<div class="row sp" style="margin-bottom:10px"><p class="muted">المقترح = اللي يوصّل كل صنف لـ '+S.st.target+' يوم سحب، بعد خصم الطلب المفتوح وإضافة اللي راجع من المصنع. ده اقتراح، مش أمر تصنيع.</p><button class="btn" data-a="copyplan">نسخ للمصنع</button></div>';
    h+='<div class="grid g2">'+ms.map(m=>'<section class="card"><h2>'+thumb(m,30)+' '+esc(mName(m))+' <span class="hint"><span class="n">'+fmt(by[m].reduce((a,r)=>a+r.q,0))+'</span> قطعة</span></h2><div class="tw"><table class="t-sm"><thead><tr><th>الصنف</th><th class="num">جاهز</th><th class="num">طلب</th><th class="num">يتصنّع</th></tr></thead><tbody>'+by[m].sort((a,b)=>skuSort(a.id,b.id)).map(r=>'<tr data-a="sku" data-sku="'+r.id+'"><td>'+sw(SKU.get(r.id).c)+' '+esc(SKU.get(r.id).c)+' · '+SKU.get(r.id).s+'</td><td class="num">'+N(r.i.R)+'</td><td class="num">'+N(r.i.dm)+'</td><td class="num"><b>'+N(r.q)+'</b></td></tr>').join('')+'</tbody></table></div></section>').join('')+'</div>';
  }else if(UI.ins==='demand'){
    const top_=(o,n)=>Object.keys(o).sort((a,b)=>o[b]-o[a]).slice(0,n);
    const bars=(o,n,lab)=>{const ks=top_(o,n),mx=o[ks[0]]||1;return ks.map(k=>hbar(lab?lab(k):esc(k),o[k],mx,fmt(o[k])+'')).join('')};
    h+='<div class="kpis" style="margin-bottom:14px">'+kpi('قطع مطلوبة في الفترة',N(C.pcs),C.days+' يوم بيانات')+kpi('موديلات بتتسحب',N(Object.keys(C.hm).length),'')+'</div>';
    h+='<div class="grid g2"><section class="card"><h2>الموديلات <span class="hint">فئة A هي أول 80% من الطلب</span></h2>'+bars(C.hm,12,m=>'<b class="mono">'+m+'</b> <span class="pill" style="padding:0 6px">'+C.abc[m]+'</span>')+'</section><section class="card"><h2>المقاسات</h2>'+Object.keys(C.hs).sort((a,b)=>szi(a)-szi(b)).map(z=>hbar(z,C.hs[z],Math.max(...Object.values(C.hs)),fmt(C.hs[z]))).join('')+'</section><section class="card"><h2>الألوان</h2>'+bars(C.hc,10,c=>sw(c)+' '+esc(c))+'</section><section class="card"><h2>المحافظات</h2>'+bars(C.hg,10)+'</section></div>';
  }else if(UI.ins==='kits'){
    const cs=Object.keys(C.combos).map(k=>Object.assign({k},C.combos[k])).filter(c=>c.n>=2).sort((a,b)=>b.n-a.n).slice(0,12);
    h+='<p class="muted" style="margin-bottom:12px">تركيبات اتطلبت مع بعض 2 مرة أو أكتر (نفس الموديلات والألوان). لو اتكررت 3 مرات أو أكتر تبقى مرشّحة تتعرّف كباندل.</p>';
    h+=cs.length?'<div class="tw"><table><thead><tr><th>التركيبة</th><th class="num">اتطلبت</th><th class="num">تكفي (حسب مقاسات أول أوردر)</th></tr></thead><tbody>'+cs.map(c=>{const need={};c.lines.forEach(s=>need[s]=(need[s]||0)+1);const cap=Math.min(...Object.keys(need).map(s=>Math.floor(Math.max(0,g(s,'READY'))/need[s])));
      return '<tr data-a="order" data-ref="'+esc(c.ex)+'"><td>'+c.k.split(' + ').map(x=>{const p=x.split('|');return '<span class="pill">'+p[0]+' '+esc(p[1])+'</span>'}).join(' ')+'</td><td class="num">'+N(c.n)+'</td><td class="num">'+(cap===0?pill('crit','0'):N(cap))+'</td></tr>'}).join('')+'</tbody></table></div>':'<div class="card"><div class="empty">مفيش تركيبات متكررة لسه.</div></div>';
    const ex=C.open.filter(o=>C.blocked[o.ref]),bv={};ex.forEach(o=>C.blocked[o.ref].forEach(x=>bv[x[0]]=(bv[x[0]]||0)+1));
    const ks=Object.keys(bv).sort((a,b)=>bv[b]-bv[a]).slice(0,10);
    if(ks.length)h+='<section class="card" style="margin-top:16px"><h2>أصناف بتوقّف أكتر أوردرات <span class="hint">اللي المصنع محتاجه الأول</span></h2>'+ks.map(s=>hbar(esc(skuName(s)),bv[s],bv[ks[0]],bv[s]+' أوردر','c')).join('')+'</section>';
  }else if(UI.ins==='team'){
    const e={};S.orders.forEach(o=>{if(o.st==='done'&&o.sc){const x=e[o.sc.by]||(e[o.sc.by]={o:0,p:0,days:{},a:o.sc.at,b:o.sc.at});x.o++;x.p+=o.lines.length;x.days[o.sc.date]=1;x.a=Math.min(x.a,o.sc.at);x.b=Math.max(x.b,o.sc.at)}});
    const ks=Object.keys(e).sort((a,b)=>e[b].o-e[a].o);
    h+=ks.length?'<div class="tw"><table><thead><tr><th>الموظف</th><th class="num">أوردرات</th><th class="num">قطع</th><th class="num">أيام شغل</th><th class="num">متوسط أوردر / يوم</th></tr></thead><tbody>'+ks.map(k=>'<tr><td>'+esc(k)+'</td><td class="num">'+N(e[k].o)+'</td><td class="num">'+N(e[k].p)+'</td><td class="num">'+N(Object.keys(e[k].days).length)+'</td><td class="num">'+N(e[k].o/Object.keys(e[k].days).length)+'</td></tr>').join('')+'</tbody></table></div><p class="muted" style="margin-top:10px">ده عدد الأوردرات المسجّلة بالسكان. وقت السكان هو وقت رفع الملف مش وقت التغليف، فمتقيّمش بيه السرعة.</p>':'<div class="card"><div class="empty">لسه مفيش أوردرات اتسكانت.</div></div>';
  }else{
    const neg=D.skus.filter(k=>g(k.id,'READY')<0),drift=D.skus.filter(k=>{const b=bal()[k.id]||{};return Object.values(b).reduce((a,v)=>a+v,0)!==0});
    const dead=D.skus.filter(k=>g(k.id,'READY')>0&&!C.vel[k.id]);const exc=C.velOK?D.skus.filter(k=>{const i=info(k.id);return i.cov!=null&&i.cov>S.st.excess}):[];
    let val=0,hasCost=false;D.skus.forEach(k=>{const c=+((S.costs[k.m]||{}).cost);if(c){hasCost=true;val+=c*total(k.id)}});
    h+='<div class="kpis" style="margin-bottom:14px">'+kpi('مجموع كل الحركات',drift.length?N(drift.length)+' خطأ':'صفر','لازم يساوي صفر لكل صنف',drift.length?'crit':'good')+kpi('أصناف بالسالب',N(neg.length),'',neg.length?'crit':'good')+kpi('أصناف راكدة',N(dead.length),'عليها رصيد ومن غير سحب في الفترة',dead.length?'warn':'')+(exc.length||C.velOK?kpi('زيادة عن اللازم',N(exc.length),'تغطية أكتر من '+S.st.excess+' يوم',''):'')+(hasCost?kpi('قيمة المخزون',N(val),'جنيه (حسب التكلفة المسجّلة)'):kpi('قيمة المخزون','—','سجّل التكلفة في الإعدادات'))+'</div>';
    h+='<section class="card"><h2>الأصناف الراكدة <span class="hint">أكبر 12 رصيدًا</span></h2>'+(dead.length?'<div class="tw"><table class="t-sm"><tbody>'+dead.sort((a,b)=>g(b.id,'READY')-g(a.id,'READY')).slice(0,12).map(k=>'<tr data-a="sku" data-sku="'+k.id+'"><td>'+sw(k.c)+' '+esc(skuName(k.id))+'</td><td class="num">'+N(g(k.id,'READY'))+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">مفيش.</div>')+'</section>';
  }
  return h;
}

/* ---------- LEDGER ---------- */
function vLedger(){
  const L=UI.led;let h=top('سجل الحركات','كل حركة اتسجلت. مفيش حاجة بتتعدّل أو بتتمسح، والتصحيح بحركة عكسية.','');
  h+='<div class="tabs" role="tablist"><button role="tab" aria-selected="'+(L.tab==='moves')+'" data-a="ltab" data-v="moves">الحركات</button><button role="tab" aria-selected="'+(L.tab==='audit')+'" data-a="ltab" data-v="audit">مين عمل إيه</button></div>';
  if(L.tab==='audit'){
    const ev=[];S.docs.forEach(d=>d.log.forEach(l=>ev.push({t:l.t,by:l.by,m:OT[d.type].ar+' '+(d.no||'مسودة')+': '+l.m})));
    S.orders.forEach(o=>{if(o.sc)ev.push({t:o.sc.at,by:o.sc.by,m:'سكان أوردر '+o.ref})});
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
  const nimg=MORDER.filter(m=>imgOf(m)).length;
  h+='<section class="card" style="margin-top:16px"><h2>صور المنتجات <span class="hint">'+nimg+' من '+MORDER.length+' عندها صورة</span></h2><div class="imggrid">'+MORDER.map(m=>'<button class="imgbtn" data-a="img" data-m="'+m+'">'+thumb(m,72)+'<span>'+m+'</span></button>').join('')+'</div></section>';
  h+='<section class="card" style="margin-top:16px"><h2>التكلفة وسعر البيع <span class="hint">اختياري. بتحسب قيمة المخزون</span></h2><div class="tw" style="max-height:340px;overflow:auto"><table class="t-sm"><thead><tr><th>الموديل</th><th class="num">تكلفة القطعة (ج)</th><th class="num">سعر البيع (ج)</th><th class="num">هامش</th></tr></thead><tbody>'+MORDER.map(m=>{const c=S.costs[m]||{},mg=(+c.cost&&+c.price)?Math.round((c.price-c.cost)/c.price*100)+'%':'—';return '<tr><td><b class="mono">'+m+'</b> <span class="muted">'+esc(MODEL.get(m).name)+'</span></td><td class="num"><input type="number" min="0" value="'+(c.cost||'')+'" data-c="cost" data-m="'+m+'" data-f="cost"></td><td class="num"><input type="number" min="0" value="'+(c.price||'')+'" data-c="cost" data-m="'+m+'" data-f="price"></td><td class="num">'+mg+'</td></tr>'}).join('')+'</tbody></table></div></section>';
  return h;
}
