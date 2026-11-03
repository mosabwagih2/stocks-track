
/* ---------- shared view helpers ---------- */
const pill=(k,t,tip)=>'<span class="pill '+k+'"'+(tip?' data-tip="'+esc(tip)+'"':'')+'>'+t+'</span>';
const hbar=(label,v,max,right,cls,tip)=>'<div class="hb"'+(tip?' data-tip="'+esc(tip)+'"':'')+'><span class="nm">'+label+'</span><div class="tr"><i class="'+(cls||'')+'" style="width:'+(max?Math.max(2,v/max*100).toFixed(1):0)+'%"></i></div><span class="v">'+right+'</span></div>';
const top=(title,sub,tools)=>'<div class="top"><div><h1>'+title+'</h1>'+(sub?'<p class="sub">'+sub+'</p>':'')+'</div><div class="tools">'+(tools||'')+'</div></div>';
const timeOf=ms=>new Date(ms).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Cairo'});
const kpi=(l,v,s,k,act)=>(act?'<button type="button" class="kpi '+(k||'')+'" data-a="'+act.split(':')[0]+'" data-w="'+(act.split(':')[1]||'')+'" data-tip="اضغط تشوف التفاصيل">':'<div class="kpi '+(k||'')+'">')+'<small>'+l+(act?' ‹':'')+'</small><b>'+v+'</b>'+(s?'<em>'+s+'</em>':'')+(act?'</button>':'</div>');
const stp=(i,v,f)=>'<span class="stp"><button type="button" data-a="ls" data-i="'+i+'" data-f="'+f+'" data-d="-1" aria-label="أقل">−</button><input type="number" min="0" value="'+v+'" data-c="ln" data-i="'+i+'" data-f="'+f+'" aria-label="الكمية"><button type="button" data-a="ls" data-i="'+i+'" data-f="'+f+'" data-d="1" aria-label="أكتر">+</button></span>';

function actions(){
  const C=ctx(),a=[],neg=D.skus.filter(k=>g(k.id,'READY')<0),bl=Object.keys(C.blocked).length,wait=C.open.length-bl;
  if(neg.length)a.push({sev:'crit',t:'رصيد بالسالب في '+neg.length+' صنف',d:'اتشحن أكتر من الرصيد. اعمل جرد للأصناف دي وصحّح الرصيد.',go:['stock',()=>{UI.s.view='table';UI.s.flt='neg';UI.s.q=''}],b:'افتح الأصناف'});
  if(bl){const pcs=C.open.filter(o=>C.blocked[o.ref]).reduce((x,o)=>x+o.lines.length,0);a.push({sev:'crit',t:bl+' أوردر هيقف بسبب الرصيد ('+fmt(pcs)+' قطعة)',d:'قطعة ناقصة واحدة في الأوردر بتوقفه كله. شوف الأصناف اللي بتعطّل أكتر.',go:['orders',()=>{UI.o.f='blocked';UI.o.tab='list'}],b:'شوف الأوردرات'})}
  if(wait>0)a.push({sev:'warn',t:wait+' أوردر لسه ما اتشحنش',d:'اتطلبوا في البيك أب وفاضل يتسجلوا بالسكان. الرصيد لسه ما اتخصمش.',go:['orders',()=>{UI.o.f='wait';UI.o.tab='list'}],b:'شوف المستنيين'});
  const low=lowList().filter(x=>x[1].cls==='w');if(low.length)a.push({sev:'warn',t:low.length+' صنف قرب يخلص',d:C.velOK?'أقل من '+S.st.cover+' يوم سحب':'أقل من الحد الأدنى القديم (لسه معندناش تاريخ كفاية).',go:['insights',()=>{UI.ins='plan'}],b:'اقتراح التصنيع'});
  const dirtyN=locSum('DIRTY');if(dirtyN>0)a.push({sev:'info',t:fmt(dirtyN)+' قطعة هالك نظافة',d:'ابعتهم للمصنع للغسيل المجاني.',go:['ops',()=>{newDoc('FSD')}],b:'إرسال للمصنع'});
  const lostN=locSum('LOST');if(lostN>0)a.push({sev:'warn',t:fmt(lostN)+' قطعة مفقودة مستنية تسوية',d:'لقيناهم ولا هنشطبهم؟',go:['ops',()=>{newDoc('LOS')}],b:'عالج المفقود'});
  const dr=S.docs.filter(d=>d.status==='draft').length;if(dr)a.push({sev:'info',t:dr+' عملية مسودة',d:'لسه ما اتأكدتش ومش مأثّرة على الرصيد.',go:['ops',()=>{UI.opF='draft';UI.doc=null}],b:'كمّلها'});
  const sl=S.sup.items.filter(s=>!s.arch&&supStatus(s)!=='good');if(sl.length)a.push({sev:'warn',t:'مستلزمات قربت تخلص: '+sl.map(s=>s.name).join('، '),d:'بيتحسب من آخر 7 أيام سكان وحد التنبيه.',go:['supplies',()=>{UI.supArch=false}],b:'المستلزمات'});
  return a;
}

/* ---------- TODAY ---------- */
function vToday(){
  const C=ctx(),date=viewDate(),isToday=date===S.date,pks=S.pickups.filter(p=>p.date===date),ids=pks.map(p=>p.id);
  const os=S.orders.filter(o=>ids.indexOf(o.pk)>=0&&o.st!=='cx'),done=os.filter(o=>o.st==='done'),open=os.filter(o=>o.st==='open'),blk=open.filter(o=>C.blocked[o.ref]);
  const pc=a=>a.reduce((x,o)=>x+o.lines.length,0),A=actions();
  const emp={};S.orders.forEach(o=>{if(o.st==='done'&&o.sc&&o.sc.date===date){const e=emp[o.sc.by]||(emp[o.sc.by]={o:0,p:0,a:o.sc.at,b:o.sc.at});e.o++;e.p+=o.lines.length;e.a=Math.min(e.a,o.sc.at);e.b=Math.max(e.b,o.sc.at)}});
  const tools='<span class="pill '+(isToday?'good':'warn')+'">'+(isToday?'النهارده · ':'بتعرض يوم سابق · ')+esc(dayName(date))+'</span>'+(isToday?'':'<button class="btn sm" data-a="vdtoday">رجوع للنهارده</button>')+'<button class="btn" data-a="upload" data-t="pickup">رفع بيك أب</button><button class="btn pri" data-a="upload" data-t="scan">رفع ملف السكان</button>';
  const older=S.orders.filter(o=>o.st==='open'&&(S.pickups.find(p=>p.id===o.pk)||{date:S.date}).date<S.date),oldDay=older.length?older.map(o=>(S.pickups.find(p=>p.id===o.pk)||{}).date).sort()[0]:'';
  let h=top(isToday?'النهارده':'يوم سابق','الطلب من القنوات، اللي اتشحن فعلًا، واللي واقف.'+(isToday?'':' العرض للقراءة بس. الرفع والتسجيل بيتم على النهارده.'),tools);
  h+='<div class="stack">';
  if(isToday&&older.length)h+='<div class="msg warn row sp"><span>فيه <b>'+older.length+'</b> أوردر من أيام فاتت (من '+esc(oldDay)+') لسه ما اتشحنوش.</span><span class="row"><button class="btn sm" data-a="vdset" data-d="'+oldDay+'">اعرض يوم '+esc(oldDay)+'</button><button class="btn sm" data-a="of2" data-v="wait">افتحهم في الأوردرات</button></span></div>';
  h+='<section class="card lift"><h2>تدفق اليوم <span class="hint">البيك أب هو المطلوب. الخصم من المخزون بيحصل بالسكان بس.</span></h2>';
  if(!os.length)h+='<div class="empty">مفيش بيك أب في اليوم ده. ارفع ملف البيك أب أو غيّر يوم العمل.</div>';
  else{
    h+='<div class="kpis" style="margin-bottom:14px">'+kpi('المطلوب (بيك أب)',N(os.length),fmt(pc(os))+' قطعة','','flow:all')+kpi('اتشحن (خرج فعلًا)',N(done.length),fmt(pc(done))+' قطعة · '+pct(done.length,os.length),'good',done.length?'flow:done':'')+kpi('لسه ما اتشحنش',N(open.length-blk.length),fmt(pc(open.filter(o=>!C.blocked[o.ref])))+' قطعة',open.length-blk.length?'warn':'',open.length-blk.length?'flow:wait':'')+kpi('هيقف بالمخزون',N(blk.length),fmt(pc(blk))+' قطعة',blk.length?'crit':'',blk.length?'flow:blocked':'')+'</div>';
    const w=x=>(x/os.length*100).toFixed(2)+'%';
    h+='<div class="flow" role="img" aria-label="اتشحن '+done.length+' من '+os.length+'"><i class="a" style="width:'+w(done.length)+'"></i><i class="b" style="width:'+w(open.length-blk.length)+'"></i><i class="c" style="width:'+w(blk.length)+'"></i></div>';
    h+='<div class="legend" style="margin-top:8px"><span><i class="dot" style="background:var(--c-ready)"></i>اتشحن</span><span><i class="dot" style="background:var(--line2)"></i>مستني الشحن</span><span><i class="dot" style="background:var(--c-scrap)"></i>هيقف بالمخزون</span></div>';
    h+='<div style="margin-top:14px;display:grid;gap:4px">'+pks.map(p=>{const po=S.orders.filter(o=>o.pk===p.id&&o.st!=='cx'),pd=po.filter(o=>o.st==='done').length;
      return '<button class="btn ghost" style="justify-content:space-between;display:flex;width:100%;color:var(--ink)" data-a="gopk" data-id="'+p.id+'"><span><b>'+esc(p.label)+'</b> <span class="muted">· '+esc(chanName(p.channel))+'</span></span><span class="n">'+pd+' / '+po.length+'</span></button>'}).join('')+'</div>';
  }
  h+='</section>';
  h+='<div class="grid split"><section class="card"><h2>محتاج تدخّل <span class="hint">'+(A.length?A.length+' حاجة':'')+'</span></h2>';
  h+=A.length?'<div class="queue">'+A.map((a,i)=>'<div class="q '+a.sev+'"><div class="ic">'+(a.sev==='info'?'i':'!')+'</div><div><b>'+a.t+'</b><span>'+a.d+'</span></div><button class="btn sm" data-a="act" data-i="'+i+'">'+a.b+'</button></div>').join('')+'</div>':'<div class="msg good">كل حاجة تمام. مفيش حاجة محتاجة تدخّل دلوقتي.</div>';
  h+='</section><div class="stack">';
  h+='<section class="card"><h2>المخزون حسب الحالة</h2>'+stateBar()+'</section>';
  h+='<section class="card"><h2>'+(isToday?'الفريق النهارده':'الفريق في اليوم ده')+'</h2>'+(Object.keys(emp).length?'<div class="tw"><table class="t-sm"><thead><tr><th>الموظف</th><th class="num">أوردرات</th><th class="num">قطع</th><th class="num">من - إلى</th></tr></thead><tbody>'+Object.keys(emp).sort((a,b)=>emp[b].o-emp[a].o).map(k=>'<tr><td>'+esc(k)+'</td><td class="num">'+N(emp[k].o)+'</td><td class="num">'+N(emp[k].p)+'</td><td class="num mono">'+timeOf(emp[k].a)+' - '+timeOf(emp[k].b)+'</td></tr>').join('')+'</tbody></table></div><p class="muted" style="margin-top:8px;font-size:12px">الوقت هو وقت تسجيل الملف، مش وقت التغليف.</p>':'<div class="empty">لسه محدش سجّل سكان النهارده.</div>')+'</section>';
  h+='</div></div></div>';
  return h;
}
function stateBar(){
  const t={};INTERNAL.forEach(l=>t[l]=locSum(l));const sum=INTERNAL.reduce((a,l)=>a+Math.max(0,t[l]),0)||1;
  return '<div class="stk">'+INTERNAL.filter(l=>t[l]>0).map(l=>'<i style="width:'+(t[l]/sum*100).toFixed(2)+'%;background:'+LCOL[l]+'" data-tip="'+LOC[l]+': '+fmt(t[l])+'"></i>').join('')+'</div>'+
    '<div style="display:grid;gap:6px;margin-top:12px">'+INTERNAL.map(l=>'<div class="row sp"><span><i class="dot" style="background:'+LCOL[l]+'"></i> '+LOC[l]+' <span class="muted" style="font-size:12px">· '+LDESC[l]+'</span></span><b class="n">'+fmt(t[l])+'</b></div>').join('')+'</div>';
}

/* ---------- ORDERS ---------- */
function ordPill(o){
  const C=ctx();
  if(o.st==='cx')return pill('','ملغي');
  if(o.st==='done')return pill('good','اتشحن · '+esc(o.sc.by),'سجّله '+o.sc.by+' الساعة '+timeOf(o.sc.at)+(o.sc.doc?' · '+o.sc.doc:''));
  if(o.bad&&o.bad.length)return pill('warn','كود غير مربوط');
  const b=C.blocked[o.ref];
  if(b)return pill('crit','هيقف · ناقص '+esc(skuName(b[0][0],false))+(b.length>1?' +'+(b.length-1):''),b.map(x=>skuName(x[0])+' ناقص '+x[1]).join('\n'));
  return pill('info','مستني الشحن');
}
function ordFilter(){
  const C=ctx(),f=UI.o.f,q=UI.o.q.trim().toLowerCase();
  return S.orders.filter(o=>{
    if(UI.o.pk&&o.pk!==UI.o.pk)return false;
    if(f==='wait'&&!(o.st==='open'&&!C.blocked[o.ref]))return false;
    if(f==='blocked'&&!(o.st==='open'&&C.blocked[o.ref]))return false;
    if(f==='done'&&o.st!=='done')return false;
    if(f==='bad'&&!(o.bad&&o.bad.length))return false;
    if(q&&String(o.ref).toLowerCase().indexOf(q)<0&&String(o.wb).indexOf(q)<0&&String(o.gov||'').indexOf(q)<0)return false;
    return true;
  });
}
function ordRows(list){
  return list.slice(0,UI.o.n).map(o=>'<tr data-a="order" data-ref="'+esc(o.ref)+'"><td data-nodrill><input type="checkbox" data-c="sel" data-ref="'+esc(o.ref)+'" '+(UI.sel[o.ref]?'checked':'')+(o.st!=='open'?' disabled':'')+' aria-label="تحديد"></td><td class="mono">'+esc(o.ref)+'</td><td class="mono muted">'+esc(o.wb)+'</td><td>'+(o.type==='استبدال'?pill('lost','استبدال'):'جديد')+'</td><td>'+esc(o.gov||'')+'</td><td class="num">'+N(o.lines.length)+'</td><td>'+ordPill(o)+'</td></tr>').join('');
}
function vOrders(){
  const C=ctx(),all=S.orders.filter(o=>o.st!=='cx'),cnt={all:all.length,wait:all.filter(o=>o.st==='open'&&!C.blocked[o.ref]).length,blocked:all.filter(o=>o.st==='open'&&C.blocked[o.ref]).length,done:all.filter(o=>o.st==='done').length};
  const bad=all.filter(o=>o.bad&&o.bad.length).length;
  const tools='<button class="btn ghost" data-a="go" data-t="files">الملفات</button><button class="btn" data-a="upload" data-t="pickup">رفع بيك أب</button><button class="btn pri" data-a="upload" data-t="scan">رفع ملف السكان</button>';
  let h=top('الأوردرات','البيك أب = المطلوب. الشحن (بالسكان) = اللي خرج فعلًا. الفرق بينهم هو الأوردرات الواقفة.',tools);
  h+='<div class="tabs" role="tablist"><button role="tab" aria-selected="'+(UI.o.tab==='list')+'" data-a="otab" data-v="list">الأوردرات</button><button role="tab" aria-selected="'+(UI.o.tab==='pick')+'" data-a="otab" data-v="pick">قائمة التجهيز</button></div>';
  if(UI.o.tab==='pick')return h+vPick();
  h+='<div class="grid g3" style="margin-bottom:14px">'+S.pickups.map(p=>{const po=S.orders.filter(o=>o.pk===p.id&&o.st!=='cx'),pd=po.filter(o=>o.st==='done').length;
    return '<button class="card flat" style="all:unset;box-sizing:border-box;cursor:pointer;background:var(--surface);border:1px solid '+(UI.o.pk===p.id?'var(--accent)':'var(--line)')+';border-radius:14px;padding:14px;display:grid;gap:8px" data-a="gopk" data-id="'+p.id+'"><span class="row sp"><b>'+esc(p.label)+'</b><span class="muted" style="font-size:12px">'+esc(p.date)+'</span></span><span class="muted" style="font-size:12px">'+esc(chanName(p.channel))+'</span><span class="flow" style="height:8px"><i class="a" style="width:'+(po.length?pd/po.length*100:0)+'%"></i></span><span class="row sp"><span class="n">'+pd+' / '+po.length+' اتشحن</span><span class="muted">'+fmt(po.reduce((x,o)=>x+o.lines.length,0))+' قطعة</span></span></button>'}).join('')+'</div>';
  const F=[['all','الكل'],['wait','مستني الشحن'],['blocked','هيقف'],['done','اتشحن']];
  h+='<div class="row" style="margin-bottom:12px"><div class="chips">'+F.map(f=>'<button class="chip" aria-pressed="'+(UI.o.f===f[0])+'" data-a="of" data-v="'+f[0]+'">'+f[1]+' <span class="n">'+cnt[f[0]]+'</span></button>').join('')+(bad?'<button class="chip" aria-pressed="'+(UI.o.f==='bad')+'" data-a="of" data-v="bad">كود غير مربوط <span class="n">'+bad+'</span></button>':'')+'</div><input type="search" id="oq" placeholder="ابحث بكود الأوردر أو البوليصة أو المحافظة" value="'+esc(UI.o.q)+'" data-c="oq" style="flex:1;min-width:200px;max-width:380px">'+(UI.o.pk?'<button class="btn sm ghost" data-a="gopk" data-id="">شيل فلتر البيك أب</button>':'')+'</div>';
  const list=ordFilter(),selN=Object.keys(UI.sel).filter(k=>UI.sel[k]).length;
  if(selN)h+='<div class="msg row sp" style="margin-bottom:12px"><span>اخترت <b>'+selN+'</b> أوردر</span><span class="row"><button class="btn sm" data-a="selclear">إلغاء الاختيار</button><button class="btn sm pri" data-a="manual">سجّلهم كأوردرات اتشحنت</button></span></div>';
  h+='<div class="tw"><table><thead><tr><th style="width:36px"></th><th>كود الأوردر</th><th>البوليصة</th><th>النوع</th><th>المحافظة</th><th class="num">قطع</th><th>الحالة</th></tr></thead><tbody id="ordrows">'+(list.length?ordRows(list):'<tr><td colspan="7" class="empty">مفيش أوردرات بالفلتر ده.</td></tr>')+'</tbody></table></div>';
  if(list.length>UI.o.n)h+='<div style="text-align:center;margin-top:12px"><button class="btn" data-a="omore">عرض المزيد ('+fmt(list.length-UI.o.n)+' متبقي)</button></div>';
  return h;
}
function vPick(){
  const C=ctx(),rows=Object.keys(C.demand).sort(skuSort);
  if(!rows.length)return '<div class="card"><div class="empty">مفيش أوردرات مفتوحة. كل اللي اتطلب اتشحن.</div></div>';
  const tot=rows.reduce((a,s)=>a+C.demand[s],0),short=rows.filter(s=>C.demand[s]>g(s,'READY'));
  let h='<div class="kpis" style="margin-bottom:14px">'+kpi('أصناف مطلوبة',N(rows.length),'')+kpi('قطع مطلوبة (لسه)',N(tot),'')+kpi('أصناف ناقصة',N(short.length),'الطلب أكبر من الجاهز',short.length?'crit':'good')+'</div>';
  h+='<p class="muted" style="margin-bottom:10px">القطع اللي لسه ما اتشحنتش، مجمّعة بالصنف. ده اللي يتجهّز من الرف.</p><div class="tw"><table class="t-sm"><thead><tr><th>الصنف</th><th class="num">مطلوب</th><th class="num">جاهز</th><th class="num">الفرق</th></tr></thead><tbody>'+
   rows.map(s=>{const R=g(s,'READY'),d=C.demand[s],k=SKU.get(s);return '<tr data-a="sku" data-sku="'+s+'"><td>'+thumb(k.m,26)+' '+sw(k.c)+' <b class="mono">'+k.m+'</b> '+esc(k.c)+' · '+k.s+'</td><td class="num">'+N(d)+'</td><td class="num">'+N(R)+'</td><td class="num">'+(R>=d?'<span class="muted">'+N(R-d)+' فاضل</span>':pill('crit','ناقص '+(d-Math.max(0,R))))+'</td></tr>'}).join('')+'</tbody></table></div>';
  return h;
}

/* ---------- sheets ---------- */
function sheetHTML(){
  const s=UI.sheet;if(!s)return '';
  let title='',body='';
  if(s.kind==='upload'){
    title=s.t==='scan'?'رفع ملف السكان':'رفع بيك أب';
    body='<div class="seg" role="group"><button type="button" aria-pressed="'+(s.t==='pickup')+'" data-a="uptype" data-v="pickup">بيك أب (المطلوب)</button><button type="button" aria-pressed="'+(s.t==='scan')+'" data-a="uptype" data-v="scan">سكان (الخارج فعلًا)</button></div>';
    if(!s.manual){
      body+='<div class="drop" id="dropz" tabindex="0" role="button" data-a="pickfile"><b>'+(s.fname?esc(s.fname):'اسحب الملف هنا أو اضغط للاختيار')+'</b><span class="muted">'+(s.t==='scan'?'تصدير QRbot (CSV) أو أي ملف فيه عمود كود الأوردر':'ملف Excel من فيندور (أعمدة: كود الاوردر العشوائي، المنتجات المطلوبة...)')+'</span></div>';
      if(s.t==='pickup')body+='<div class="grid g2"><label class="f">القناة<select data-c="upch" id="upch">'+CHAN.map(c=>'<option value="'+c.id+'" '+(s.channel===c.id?'selected':'')+'>'+c.name+(c.ok?'':' (التنسيق مش متاح لسه)')+'</option>').join('')+'</select></label><div class="f">تاريخ البيك أب'+(s.unlock?'<input type="date" id="updt" value="'+s.date+'" max="'+S.date+'" data-c="updt">':'<span class="row" style="color:var(--ink);gap:8px"><b class="mono">'+s.date+'</b>'+pill('good','النهارده')+'<button type="button" class="btn sm ghost" data-a="updtunlock">تغيير</button></span>')+'</div></div>';
    }else body+='<div class="msg">تسجيل يدوي لأوردرات اخترتها من القائمة، من غير ملف.</div>';
    if(s.err)body+='<div class="msg crit">'+esc(s.err)+'</div>';
    if(s.t==='scan'&&s.res){
      const r=s.res,pcs=r.matched.reduce((a,m)=>a+(orderByRef(m.ref)||{lines:[]}).lines.length,0);
      body+='<label class="f">اسم الموظف (اللي سكان)<input id="upemp" list="emps" value="'+esc(s.emp||'')+'" data-c="upemp" placeholder="مثلًا: عبدالله"></label><datalist id="emps">'+S.emps.map(e=>'<option value="'+esc(e)+'">').join('')+'</datalist>';
      body+='<div class="kpis">'+kpi('سكان في الملف',N(r.scans),'')+kpi('أوردر جديد',N(r.matched.length),fmt(pcs)+' قطعة هتتخصم','good')+kpi('اتسجّل قبل كده',N(r.already.length),'',r.already.length?'warn':'')+kpi('كود غير معروف',N(r.unk.length),'',r.unk.length?'crit':'')+'</div>';
      if(r.dups.length)body+='<div class="msg warn">'+r.dups.length+' سكان مكرر في نفس الملف اتخطّى.</div>';
      if(r.already.length)body+='<div class="msg warn">'+r.already.length+' أوردر اتسجّل قبل كده'+(r.already[0].by?' (مثلًا بواسطة '+esc(r.already[0].by)+')':'')+' ومش هيتخصم تاني.</div>';
      if(r.unk.length)body+='<div class="msg crit">أكواد مش موجودة في أي بيك أب: <span class="mono">'+r.unk.slice(0,12).map(esc).join('، ')+'</span>'+(r.unk.length>12?' ...':'')+'<br>ارفع البيك أب بتاعها الأول.</div>';
      if(r.bad.length)body+='<div class="msg warn">'+r.bad.length+' أوردر فيه صنف مش مربوط بالكتالوج. اربطه الأول.</div>';
      const neg=scanNeg(r.matched);
      if(neg.length)body+='<div class="msg warn"><b>الرصيد مش كفاية لـ '+neg.length+' صنف</b>، بس السكان مش هيتمنع. هيبقى بالسالب ويظهر في "محتاج تدخّل":<ul>'+neg.slice(0,6).map(x=>'<li>'+esc(skuName(x[0]))+': رصيد '+x[1]+' والمشحون '+x[2]+'</li>').join('')+'</ul></div>';
      body+='<button class="btn pri" data-a="scansave" '+((r.matched.length&&(s.emp||'').trim())?'':'disabled')+'>تأكيد وخصم '+fmt(pcs)+' قطعة من المخزون</button>';
    }
    if(s.t==='pickup'&&s.res){
      const r=s.res,pcs=r.orders.reduce((a,o)=>a+o.lines.length,0),bad=r.orders.filter(o=>o.bad.length).length;
      body+='<div class="kpis">'+kpi('أوردر جديد',N(r.orders.length),fmt(pcs)+' قطعة','good')+kpi('مكرر (موجود)',N(r.dups.length),'',r.dups.length?'warn':'')+kpi('أصناف مش مربوطة',N(bad),'',bad?'crit':'')+'</div>';
      if(r.unk.length)body+='<div class="msg warn">أكواد موديل مش معروفة: <span class="mono">'+r.unk.map(esc).join('، ')+'</span>. الأوردرات دي هتتعلّم "كود غير مربوط" لحد ما تتربط.</div>';
      if(s.date!==S.date)body+='<div class="msg warn">التاريخ ده مش النهارده ('+esc(S.date)+'). البيك أب هيتحسب كطلب على '+esc(s.date)+'. اتأكد إنه صح.</div>';
      body+='<div class="msg">البيك أب مش بيخصم من المخزون. بيتحسب كطلب بس لحد ما الأوردرات تتشحن. بيانات العملاء ما بتتحفظش.</div>';
      body+='<button class="btn pri" data-a="pksave" '+(r.orders.length?'':'disabled')+'>استيراد '+r.orders.length+' أوردر</button>';
    }
  }else if(s.kind==='order'){
    const o=orderByRef(s.ref);if(!o)return '';title='أوردر '+o.ref;const C=ctx(),cnt={};o.lines.forEach(x=>cnt[x]=(cnt[x]||0)+1);
    body='<div class="row">'+ordPill(o)+'<span class="muted">'+esc(chanName((S.pickups.find(p=>p.id===o.pk)||{}).channel))+' · '+esc((S.pickups.find(p=>p.id===o.pk)||{}).label)+'</span></div>';
    body+='<div class="grid g2"><div class="kpi"><small>البوليصة</small><b style="font-size:18px">'+esc(o.wb)+'</b></div><div class="kpi"><small>المحافظة / النوع</small><b style="font-size:18px;font-family:var(--f-ar)">'+esc(o.gov||'')+' · '+esc(o.type)+'</b></div></div>';
    body+='<div class="tw"><table class="t-sm"><thead><tr><th>الصنف</th><th class="num">في الأوردر</th><th class="num">جاهز دلوقتي</th></tr></thead><tbody>'+Object.keys(cnt).sort(skuSort).map(x=>{const R=g(x,'READY');return '<tr><td>'+thumb(SKU.get(x).m,26)+' '+sw(SKU.get(x).c)+' '+esc(skuName(x))+'</td><td class="num">'+N(cnt[x])+'</td><td class="num">'+(R<cnt[x]&&o.st==='open'?pill('crit',R):N(R))+'</td></tr>'}).join('')+'</tbody></table></div>';
    if(o.bad&&o.bad.length)body+='<div class="msg warn">أصناف مش مربوطة: '+o.bad.map(b=>esc(b[0]+' '+b[2]+' '+b[1])).join('، ')+'</div>';
    if(o.st==='done')body+='<div class="msg good">اتشحن بواسطة '+esc(o.sc.by)+' يوم '+esc(o.sc.date)+' الساعة '+timeOf(o.sc.at)+' · '+esc(o.sc.doc)+'</div>';
    if(o.st==='open')body+='<div class="row"><button class="btn danger sm" data-a="cxorder" data-ref="'+esc(o.ref)+'">إلغاء الأوردر (ملغي من القناة)</button></div>';
    if(o.st==='cx')body+='<div class="row"><button class="btn sm" data-a="uncx" data-ref="'+esc(o.ref)+'">رجّعه مفتوح</button></div>';
  }else if(s.kind==='sup'||s.kind==='supnew'){
    const r=supSheet(s);title=r.title;body=r.body;
  }else if(s.kind==='modelrm'){
    const r=modelRmSheet(s);title=r.title;body=r.body;
  }else if(s.kind==='skuadd'){
    const r=skuAddSheet(s);title=r.title;body=r.body;
  }else if(s.kind==='flow'){
    const r=flowSheet(s.w);title=r.title;body=r.body;
  }else if(s.kind==='pkedit'){
    const r=pkEditSheet(s);title=r.title;body=r.body;
  }else if(s.kind==='scedit'){
    const r=scEditSheet(s);title=r.title;body=r.body;
  }else if(s.kind==='img'){
    title='صورة '+mName(s.m);const u=imgOf(s.m);
    body=(u?'<img class="bigimg" src="'+u+'" alt="'+esc(s.m)+'">':'<div class="drop" data-a="pickimg" data-m="'+s.m+'"><b>مفيش صورة للموديل ده</b><span class="muted">اضغط لاختيار صورة (الأفضل خلفية فاتحة وصورة المنتج كله)</span></div>')+'<div class="row"><button class="btn pri" data-a="pickimg" data-m="'+s.m+'">'+(u?'تغيير الصورة':'رفع صورة')+'</button>'+(u?'<button class="btn danger" data-a="rmimg" data-m="'+s.m+'">إزالة</button>':'')+'</div><p class="muted" style="font-size:12px">أي صورة بترفعها بتتحوّل أوتوماتيك لمربع 1:1 (600×600) من غير قص: الصورة كاملة بتتحط في النص وبياض الخلفية بياخد لون ركن الصورة. الأفضل ترفعها مربعة من الأول (مثلًا 1000×1000). بتتحفظ في المتصفح ده بس.</p>';
  }else if(s.kind==='sku'){
    const k=SKU.get(s.sku),i=info(s.sku);title=skuName(s.sku);
    body='<div class="row" style="flex-wrap:nowrap;gap:14px"><button class="imgbtn" data-a="img" data-m="'+k.m+'" aria-label="صورة الموديل">'+thumb(k.m,84)+'</button><div><b>'+esc(mName(k.m))+'</b><div class="muted">'+sw(k.c)+' '+esc(k.c)+' · مقاس '+k.s+'</div></div></div>';
    body+='<div class="kpis">'+kpi('جاهز للبيع',N(i.R),'',i.R<0?'crit':'')+kpi('مطلوب (مفتوح)',N(i.dm),i.dm>i.R?'أكتر من الجاهز':'',i.dm>i.R?'crit':'')+kpi('سرعة السحب',i.v?'<span class="n">'+i.v.toFixed(1)+'</span>':'—','قطعة / يوم')+kpi('يغطّي',i.cov!=null?'<span class="n">'+Math.floor(i.cov)+'</span>':'—','يوم')+'</div>';
    body+='<div class="tw"><table class="t-sm"><tbody>'+INTERNAL.map(l=>'<tr><td><i class="dot" style="background:'+LCOL[l]+'"></i> '+LOC[l]+' <span class="muted" style="font-size:12px">'+LDESC[l]+'</span></td><td class="num">'+N(g(s.sku,l))+'</td></tr>').join('')+'<tr><td><b>الإجمالي في ملكنا</b></td><td class="num"><b>'+N(total(s.sku))+'</b></td></tr></tbody></table></div>';
    body+='<div class="chips"><button class="btn sm" data-a="skuop" data-t="CLN" data-sku="'+s.sku+'">نقل لهالك نظافة</button><button class="btn sm" data-a="skuop" data-t="RCV" data-sku="'+s.sku+'">استلام</button><button class="btn sm" data-a="skuop" data-t="CNT" data-sku="'+s.sku+'">جرد الصنف</button></div>';
    body+=skuRemoveBlock(s);
    const mv=S.moves.filter(m=>m.sku===s.sku).slice(-10).reverse();
    body+='<h3 style="font-size:15px">آخر الحركات</h3>'+(mv.length?'<div class="tw"><table class="t-sm"><tbody>'+mv.map(m=>'<tr><td class="mono muted">'+esc(m.date)+'</td><td>'+esc(m.note||OT[m.type]&&OT[m.type].ar||m.type)+'<div class="muted" style="font-size:12px">من '+esc(LOC[m.from])+' إلى '+esc(LOC[m.to])+'</div></td><td class="num mono">'+m.q+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">مفيش حركات.</div>');
  }
  return '<div class="scrim" data-a="closesheet"></div><aside class="sheet" role="dialog" aria-label="'+esc(title)+'"><header><h2>'+esc(title)+'</h2><button class="btn sm ghost x" data-a="closesheet" aria-label="إغلاق">إغلاق ✕</button></header><div class="body">'+body+'</div></aside>';
}
function scanNeg(matched){
  const a={};matched.forEach(m=>{const o=orderByRef(m.ref);if(o)o.lines.forEach(s=>a[s]=(a[s]||0)+1)});
  return Object.keys(a).filter(s=>g(s,'READY')<a[s]).map(s=>[s,g(s,'READY'),a[s]]);
}
