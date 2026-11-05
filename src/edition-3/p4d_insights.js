
/* ---------- INSIGHTS (redesigned) ---------- */
const INS_TABS=[['over','نظرة عامة'],['demand','الطلب'],['plan','التصنيع'],['stuck','الواقف'],['team','الفريق'],['health','صحة المخزون']];
const INS_PER=[['1','النهارده'],['7','7 أيام'],['14','14 يوم'],['30','30 يوم'],['all','كل البيانات']];
const shortDay=d=>d.slice(8,10)+'/'+d.slice(5,7);
const shareP=(v,t)=>t?Math.round(v/t*100):0;

function anData(){
  const P=UI.insP||'all',end=S.date,pkD=Object.fromEntries(S.pickups.map(p=>[p.id,p.date])),chOf=Object.fromEntries(S.pickups.map(p=>[p.id,p.channel])),from=P==='all'?'0000-00-00':addDays(end,-(+P-1));
  const A={P,from,end,os:[],o:0,p:0,days:{},m:{},s:{},c:{},g:{},ty:{},ch:{},mc:{},sku:{},bk:{'1':0,'2':0,'3-4':0,'5+':0},done:0};
  S.orders.forEach(o=>{
    if(o.st==='cx')return;const d=pkD[o.pk];if(!d||d<from||d>end)return;
    const n=o.lines.length;A.os.push(o);A.o++;A.p+=n;if(o.st==='done')A.done++;
    const dd=A.days[d]||(A.days[d]={o:0,p:0,done:0});dd.o++;dd.p+=n;if(o.st==='done')dd.done++;
    o.lines.forEach(s=>{const k=SKU.get(s);if(!k)return;A.m[k.m]=(A.m[k.m]||0)+1;A.s[k.s]=(A.s[k.s]||0)+1;A.c[k.c]=(A.c[k.c]||0)+1;A.sku[s]=(A.sku[s]||0)+1;const r=A.mc[k.m]||(A.mc[k.m]={});r[k.s]=(r[k.s]||0)+1});
    if(o.gov)A.g[o.gov]=(A.g[o.gov]||0)+1;
    A.ty[o.type]=(A.ty[o.type]||0)+1;const ch=chOf[o.pk];A.ch[ch]=(A.ch[ch]||0)+1;
    A.bk[n===1?'1':n===2?'2':n<=4?'3-4':'5+']++;
  });
  A.nDays=Object.keys(A.days).length;
  return A;
}
const topKeys=(o,n)=>Object.keys(o).sort((a,b)=>o[b]-o[a]).slice(0,n);
function card(title,body,hint,cls){return '<section class="card '+(cls||'')+'"><h2>'+title+(hint?' <span class="hint">'+hint+'</span>':'')+'</h2>'+body+'</section>'}
function tile(label,val,sub,kind,go){return kpi(label,val,sub,kind,go?'instab:'+go:'')}
function noData(){return '<div class="card"><div class="empty">مفيش أوردرات في الفترة دي. اختار فترة أطول من فوق أو ارفع بيك أب.</div></div>'}

function insNotes(A,C){
  const n=[],tot=A.p;
  if(!A.o)return n;
  const mk=topKeys(A.m,12),m1=mk[0];
  n.push({k:'info',t:'<b>'+esc(mName(m1))+'</b> هو الأكتر طلبًا: '+shareP(A.m[m1],tot)+'% من القطع ('+fmt(A.m[m1])+' قطعة).'});
  let cum=0,cnt=0;for(const m of topKeys(A.m,99)){cum+=A.m[m];cnt++;if(cum/tot>=.8)break}
  n.push({k:'info',t:'<b>'+cnt+' موديل</b> من '+Object.keys(A.m).length+' بيمثّلوا 80% من الطلب. دول اللي المصنع يركّز عليهم.'});
  const sk=topKeys(A.s,1)[0];n.push({k:'info',t:'أكتر مقاس مطلوب <b>'+esc(sk)+'</b> ('+shareP(A.s[sk],tot)+'%)، وأكتر لون <b>'+esc(topKeys(A.c,1)[0])+'</b>.'});
  const bl=Object.keys(C.blocked).length;
  if(bl){const bv={};C.open.forEach(o=>{if(C.blocked[o.ref])C.blocked[o.ref].forEach(x=>bv[x[0]]=(bv[x[0]]||0)+1)});const b1=topKeys(bv,1)[0];n.push({k:'crit',t:'<b>'+bl+' أوردر هيقف</b> بسبب نقص رصيد. أكتر صنف بيعطّل: <b>'+esc(skuName(b1))+'</b> ('+bv[b1]+' أوردر).'})}
  const pr=planRows();if(pr.length)n.push({k:'warn',t:'<b>'+pr.length+' صنف</b> محتاج تصنيع (<b>'+fmt(pr.reduce((a,r)=>a+r.q,0))+'</b> قطعة مقترحة).'});
  if(A.o)n.push({k:A.done/A.o>=.8?'good':'warn',t:'اتشحن <b>'+shareP(A.done,A.o)+'%</b> من الأوردرات المطلوبة ('+A.done+' من '+A.o+').'});
  return n;
}
function trendChart(A){
  let ds=Object.keys(A.days).sort();if(!ds.length)return '<div class="empty">مفيش بيانات.</div>';
  ds=ds.slice(-14);const mx=Math.max(...ds.map(d=>A.days[d].p));
  return '<div class="col" role="img" aria-label="الطلب اليومي">'+ds.map(d=>{const x=A.days[d];return '<div class="b" data-tip="'+d+'\n'+x.o+' أوردر · '+x.p+' قطعة\nاتشحن '+x.done+'"><small>'+fmt(x.p)+'</small><i style="height:'+Math.max(4,x.p/mx*100)+'px"></i><span class="lb">'+shortDay(d)+'</span></div>'}).join('')+'</div><div class="legend" style="margin-top:8px"><span>عدد القطع المطلوبة في اليوم</span>'+(ds.length<3?'<span>(عندنا '+ds.length+' يوم بيانات بس)</span>':'')+'</div>';
}
function modelBars(A,n){
  const ks=topKeys(A.m,n),mx=A.m[ks[0]]||1,C=ctx();
  return ks.map(m=>hbar('<b class="mono">'+esc(m)+'</b> <span class="muted" style="font-size:12px">'+esc(MODEL.get(m)?MODEL.get(m).name:'')+'</span>',A.m[m],mx,fmt(A.m[m])+' · '+shareP(A.m[m],A.p)+'%',C.abc[m]==='A'?'':C.abc[m]==='B'?'w':'g')).join('')+'<div class="legend" style="margin-top:8px"><span><i class="dot" style="background:var(--accent)"></i>فئة A (أول 80%)</span><span><i class="dot" style="background:var(--c-dirty)"></i>فئة B</span><span><i class="dot" style="background:var(--c-ready)"></i>فئة C</span></div>';
}
function heatmap(A){
  const ms=topKeys(A.m,14),szs=SIZES.filter(z=>A.s[z]),mx=Math.max(1,...ms.map(m=>Math.max(...szs.map(z=>(A.mc[m]||{})[z]||0))));
  return '<div class="tw"><table class="hm"><thead><tr><th></th>'+szs.map(z=>'<th>'+z+'</th>').join('')+'<th>الإجمالي</th></tr></thead><tbody>'+ms.map(m=>'<tr><th style="text-align:start;background:none;position:static"><b class="mono">'+esc(m)+'</b></th>'+szs.map(z=>{const v=(A.mc[m]||{})[z]||0,a=Math.round(v/mx*88);return '<td style="text-align:center;background:'+(v?'color-mix(in srgb,var(--accent) '+a+'%,var(--surface))':'var(--grid)')+';color:'+(a>50?'var(--on-accent)':'var(--ink)')+';border-radius:6px;min-width:46px;padding:6px 4px;font:500 12px var(--f-mono)">'+(v||'')+'</td>'}).join('')+'<td style="text-align:center;font:600 12px var(--f-mono)">'+fmt(A.m[m])+'</td></tr>').join('')+'</tbody></table></div>';
}

function vInsights(){
  const C=ctx(),A=anData(),T=UI.ins&&INS_TABS.some(t=>t[0]===UI.ins)?UI.ins:'over';
  let h=top('التحليلات','قرارات مبنية على الطلب الفعلي: نصنّع إيه، إيه بيتباع، إيه واقف، ومين شغال.','<div class="seg" role="group" aria-label="الفترة">'+INS_PER.map(p=>'<button aria-pressed="'+((UI.insP||'all')===p[0])+'" data-a="insper" data-v="'+p[0]+'">'+p[1]+'</button>').join('')+'</div>');
  h+='<div class="tabs" role="tablist">'+INS_TABS.map(t=>'<button role="tab" aria-selected="'+(T===t[0])+'" data-a="instab" data-v="'+t[0]+'">'+t[1]+'</button>').join('')+'</div>';
  if(A.nDays&&A.nDays<3&&(T==='over'||T==='demand'||T==='plan'))h+='<div class="msg warn" style="margin-bottom:14px">عندنا <b>'+A.nDays+' يوم</b> بيانات طلب بس. الأرقام دقيقة للأيام دي، بس مش كفاية نحدد اتجاه أو سرعة سحب مضمونة قبل 3 أيام.</div>';
  h+=({over:insOver,demand:insDemand,plan:insPlan,stuck:insStuck,team:insTeam,health:insHealth})[T](A,C);
  return h;
}

function insOver(A,C){
  if(!A.o)return noData();
  const bl=Object.keys(C.blocked).length,pr=planRows(),notes=insNotes(A,C);
  let h='<div class="kpis" style="margin-bottom:16px">'+tile('أوردرات مطلوبة',N(A.o),fmt(A.p)+' قطعة','','demand')+tile('متوسط القطع في الأوردر','<span class="n">'+(A.p/A.o).toFixed(1)+'</span>',A.bk['1']+' أوردر قطعة واحدة','','demand')+tile('اتشحن',N(A.done),shareP(A.done,A.o)+'% من المطلوب','good','')+tile('هيقف بالمخزون',N(bl),'أوردر',bl?'crit':'','stuck')+tile('محتاج تصنيع',N(pr.length),fmt(pr.reduce((a,r)=>a+r.q,0))+' قطعة',pr.length?'warn':'','plan')+'</div>';
  h+='<div class="grid split">'+card('أهم الملاحظات','<div>'+notes.map(x=>'<div class="insn"><span class="ic '+x.k+'">'+(x.k==='crit'?'!':x.k==='warn'?'!':x.k==='good'?'✓':'i')+'</span><span>'+x.t+'</span></div>').join('')+'</div>')+card('الطلب اليومي',trendChart(A))+'</div>';
  h+='<div class="grid g2" style="margin-top:16px">'+card('حصة الموديلات من الطلب',modelBars(A,8),'أعلى 8 موديلات')+'<div class="stack">'+card('المقاسات',Object.keys(A.s).sort((a,b)=>szi(a)-szi(b)).map(z=>hbar(z,A.s[z],Math.max(...Object.values(A.s)),fmt(A.s[z])+' · '+shareP(A.s[z],A.p)+'%')).join(''))+card('نوع الأوردر',Object.keys(A.ty).map(k=>hbar(esc(k),A.ty[k],A.o,fmt(A.ty[k])+' · '+shareP(A.ty[k],A.o)+'%',k==='استبدال'?'w':'g')).join(''))+'</div></div>';
  return h;
}
function insDemand(A,C){
  if(!A.o)return noData();
  let h='<div class="kpis" style="margin-bottom:16px">'+kpi('قطع مطلوبة',N(A.p),A.o+' أوردر')+kpi('موديلات بتتسحب',N(Object.keys(A.m).length),'من '+MORDER.length)+kpi('أصناف بتتسحب',N(Object.keys(A.sku).length),'من '+D.skus.length+' صنف')+'</div>';
  h+=card('خريطة الطلب: الموديل × المقاس','<p class="muted" style="margin-bottom:10px;font-size:13px">كل خانة هي عدد القطع المطلوبة. اللون الأغمق يعني طلب أكتر.</p>'+heatmap(A),'أعلى 14 موديل');
  h+='<div class="grid g2" style="margin-top:16px">'+card('الألوان',topKeys(A.c,10).map(c=>hbar(sw(c)+' '+esc(c),A.c[c],A.c[topKeys(A.c,1)[0]],fmt(A.c[c])+' · '+shareP(A.c[c],A.p)+'%')).join(''),'أعلى 10')+card('المحافظات',Object.keys(A.g).length?topKeys(A.g,10).map(g_=>hbar(esc(g_),A.g[g_],A.g[topKeys(A.g,1)[0]],fmt(A.g[g_])+' أوردر')).join(''):'<div class="empty">مفيش بيانات محافظات.</div>','أعلى 10')+'</div>';
  const bk=A.bk,mxb=Math.max(...Object.values(bk),1);
  h+='<div class="grid g2" style="margin-top:16px">'+card('حجم الأوردر','<p class="muted" style="margin-bottom:8px;font-size:13px">كام قطعة في الأوردر الواحد</p>'+['1','2','3-4','5+'].map(k=>hbar(k==='1'?'قطعة واحدة':k==='2'?'قطعتين':k+' قطع',bk[k],mxb,fmt(bk[k])+' · '+shareP(bk[k],A.o)+'%')).join(''))+insKits(C)+'</div>';
  return h;
}
function insKits(C){
  const cs=Object.keys(C.combos).map(k=>Object.assign({k},C.combos[k])).filter(c=>c.n>=2&&c.lines.length<=6).sort((a,b)=>b.n-a.n).slice(0,8);
  return card('الباندلز المتكررة',cs.length?'<p class="muted" style="margin-bottom:8px;font-size:13px">تركيبات صغيرة (لحد 6 قطع) اتطلبت 2+ مرة بنفس الموديلات والألوان. 3+ مرات تبقى مرشّحة تتعرّف كباندل.</p><div class="tw"><table class="t-sm"><thead><tr><th>التركيبة</th><th class="num">مرات</th><th class="num">تكفي</th></tr></thead><tbody>'+cs.map(c=>{const need={};c.lines.forEach(s=>need[s]=(need[s]||0)+1);const cap=Math.min(...Object.keys(need).map(s=>Math.floor(Math.max(0,g(s,'READY'))/need[s])));return '<tr data-a="order" data-ref="'+esc(c.ex)+'"><td>'+c.k.split(' + ').map(x=>{const p=x.split('|');return '<span class="pill">'+p[0]+' '+esc(p[1])+'</span>'}).join(' ')+'</td><td class="num">'+N(c.n)+'</td><td class="num">'+(cap===0?pill('crit','0'):N(cap))+'</td></tr>'}).join('')+'</tbody></table></div>':'<div class="empty">مفيش تركيبات متكررة لسه.</div>','حسب مقاسات أول أوردر');
}
function insPlan(A,C){
  const all=planRows(),L=UI.insL||'all',rows=all.filter(r=>L==='all'||lineOf(SKU.get(r.id).m)===L),by={};
  rows.forEach(r=>{(by[SKU.get(r.id).m]||(by[SKU.get(r.id).m]=[])).push(r)});
  const ms=Object.keys(by).sort((a,b)=>by[b].reduce((x,r)=>x+r.q,0)-by[a].reduce((x,r)=>x+r.q,0)),tot=rows.reduce((a,r)=>a+r.q,0),crit=rows.filter(r=>r.i.cls==='c').length;
  let h='<div class="kpis" style="margin-bottom:16px">'+kpi('قطع مقترحة',N(tot),'للتصنيع',tot?'warn':'')+kpi('أصناف',N(rows.length),'في '+ms.length+' موديل')+kpi('حرجة (خلصت أو الطلب أكبر)',N(crit),'',crit?'crit':'')+kpi('الهدف',N(S.st.target),'يوم تغطية')+'</div>';
  h+='<div class="row sp" style="margin-bottom:12px"><div class="chips">'+[['all','الكل']].concat(LINE_ORDER.map(l=>[l,l])).map(f=>'<button class="chip" aria-pressed="'+(L===f[0])+'" data-a="insline" data-v="'+f[0]+'">'+f[1]+'</button>').join('')+'</div><button class="btn pri" data-a="copyplan">نسخ للمصنع</button></div>';
  if(!rows.length)return h+'<div class="card"><div class="empty">مفيش أصناف تحت الحد حاليًا'+(L!=='all'?' في '+L:'')+'.</div></div>';
  h+='<p class="muted" style="margin-bottom:12px;font-size:13px">المقترح = اللي يوصّل كل صنف لـ '+S.st.target+' يوم سحب بعد خصم الطلب المفتوح وإضافة اللي راجع من المصنع'+(C.velOK?'':'. لسه مفيش تاريخ كفاية، فالحساب على الحد الأدنى القديم')+'. ده اقتراح، مش أمر تصنيع.</p>';
  const mx=by[ms[0]].reduce((a,r)=>a+r.q,0);
  h+=card('اللي نصنّعه حسب الموديل',ms.slice(0,10).map(m=>{const q=by[m].reduce((a,r)=>a+r.q,0);return hbar('<b class="mono">'+esc(m)+'</b>',q,mx,fmt(q)+' قطعة','w')}).join(''))+'<div class="stack" style="margin-top:16px">'+ms.map((m,i)=>{const rs=by[m].sort((a,b)=>(a.i.cls==='c'?0:1)-(b.i.cls==='c'?0:1)||skuSort(a.id,b.id)),q=rs.reduce((a,r)=>a+r.q,0),cr=rs.filter(r=>r.i.cls==='c').length;
    return '<details class="dd" '+(i<2?'open':'')+'><summary><span class="row" style="gap:10px;flex-wrap:nowrap">'+thumb(m,34)+'<b>'+esc(mName(m))+'</b></span><span class="row">'+(cr?pill('crit',cr+' حرج'):'')+pill('',rs.length+' صنف')+'<b class="n">'+fmt(q)+'</b><span class="muted">قطعة</span></span></summary><div class="tw" style="border:0;border-top:1px solid var(--line);border-radius:0"><table class="t-sm"><thead><tr><th>الصنف</th><th class="num">جاهز</th><th class="num">طلب مفتوح</th><th class="num">راجع من المصنع</th><th class="num">يتصنّع</th><th></th></tr></thead><tbody>'+rs.map(r=>'<tr data-a="sku" data-sku="'+r.id+'"><td>'+sw(SKU.get(r.id).c)+' '+esc(SKU.get(r.id).c)+' · '+SKU.get(r.id).s+'</td><td class="num">'+N(r.i.R)+'</td><td class="num">'+N(r.i.dm)+'</td><td class="num">'+N(r.pend)+'</td><td class="num"><b>'+N(r.q)+'</b></td><td>'+(r.i.cls==='c'?pill('crit','حرج'):pill('warn','قرب'))+'</td></tr>').join('')+'</tbody></table></div></details>'}).join('')+'</div>';
  return h;
}
function insStuck(A,C){
  const bl=C.open.filter(o=>C.blocked[o.ref]),wait=C.open.filter(o=>!C.blocked[o.ref]),pk=Object.fromEntries(S.pickups.map(p=>[p.id,p.date])),old=C.open.filter(o=>pk[o.pk]<S.date);
  let h='<div class="kpis" style="margin-bottom:16px">'+kpi('هيقف بالمخزون',N(bl.length),fmt(bl.reduce((a,o)=>a+o.lines.length,0))+' قطعة',bl.length?'crit':'good')+kpi('مستني الشحن',N(wait.length),fmt(wait.reduce((a,o)=>a+o.lines.length,0))+' قطعة',wait.length?'warn':'')+kpi('من أيام فاتت',N(old.length),'لسه ما اتشحنوش',old.length?'warn':'good')+'</div>';
  if(!C.open.length)return h+'<div class="card"><div class="msg good">مفيش أوردرات مفتوحة. كل اللي اتطلب اتشحن.</div></div>';
  const bv={};bl.forEach(o=>C.blocked[o.ref].forEach(x=>{const e=bv[x[0]]||(bv[x[0]]={n:0,q:0});e.n++;e.q+=x[1]}));
  const ks=Object.keys(bv).sort((a,b)=>bv[b].n-bv[a].n).slice(0,10);
  h+='<div class="grid g2">'+card('الأصناف اللي بتعطّل أكتر أوردرات',ks.length?'<p class="muted" style="margin-bottom:8px;font-size:13px">لو اتوفّرت دي، أكتر أوردرات هتتحرك. ده اللي المصنع محتاجه الأول.</p>'+ks.map(s=>hbar(esc(skuName(s)),bv[s].n,bv[ks[0]].n,bv[s].n+' أوردر · ناقص '+bv[s].q,'c')).join(''):'<div class="msg good">مفيش أوردرات واقفة بسبب الرصيد.</div>')+card('عمر الأوردرات المفتوحة',(()=>{const ag={};C.open.forEach(o=>{const d=pk[o.pk],k=d>=S.date?'النهارده':dayDiff(d,S.date)+' يوم';ag[k]=(ag[k]||0)+1});const kk=Object.keys(ag);return kk.map(k=>hbar(k,ag[k],Math.max(...Object.values(ag)),fmt(ag[k])+' أوردر',k==='النهارده'?'g':'w')).join('')})(),'من تاريخ البيك أب')+'</div>';
  if(bl.length)h+='<h2 style="font-size:17px;margin:20px 0 10px">أوردرات واقفة ('+bl.length+')</h2><div class="tw"><table class="t-sm"><thead><tr><th>الكود</th><th class="num">قطع</th><th>الناقص فيه</th><th class="num">عمره (يوم)</th></tr></thead><tbody>'+bl.slice(0,25).map(o=>'<tr data-a="order" data-ref="'+esc(o.ref)+'"><td class="mono">'+esc(o.ref)+'</td><td class="num">'+N(o.lines.length)+'</td><td>'+C.blocked[o.ref].map(x=>'<span class="pill crit" style="margin:2px">'+esc(skuName(x[0]))+' ×'+x[1]+'</span>').join(' ')+'</td><td class="num">'+N(Math.max(0,dayDiff(pk[o.pk],S.date)))+'</td></tr>').join('')+'</tbody></table></div>'+(bl.length>25?'<p class="muted" style="margin-top:8px">أول 25. الباقي في صفحة الأوردرات.</p>':'');
  return h;
}
function insTeam(A,C){
  const e={},dayEmp={};S.orders.forEach(o=>{if(o.st==='done'&&o.sc){const x=e[o.sc.by]||(e[o.sc.by]={o:0,p:0,days:{},a:o.sc.at,b:o.sc.at});x.o++;x.p+=o.lines.length;x.days[o.sc.date]=1;x.a=Math.min(x.a,o.sc.at);x.b=Math.max(x.b,o.sc.at);const d=dayEmp[o.sc.date]||(dayEmp[o.sc.date]={});d[o.sc.by]=(d[o.sc.by]||0)+1}});
  const ks=Object.keys(e).sort((a,b)=>e[b].o-e[a].o);
  if(!ks.length)return '<div class="card"><div class="empty">لسه مفيش أوردرات اتشحنت. بعد أول ملف سكان بتظهر هنا إحصائيات الموظفين.</div></div>';
  const tot=ks.reduce((a,k)=>a+e[k].o,0),mx=e[ks[0]].o;
  let h='<div class="kpis" style="margin-bottom:16px">'+kpi('موظفين',N(ks.length),'')+kpi('أوردرات اتشحنت',N(tot),fmt(ks.reduce((a,k)=>a+e[k].p,0))+' قطعة','good')+kpi('أعلى موظف',esc(ks[0]),fmt(e[ks[0]].o)+' أوردر')+'</div>';
  h+='<div class="grid split">'+card('الأوردرات حسب الموظف',ks.map(k=>hbar(esc(k),e[k].o,mx,fmt(e[k].o)+' · '+shareP(e[k].o,tot)+'%')).join(''))+card('التفاصيل','<div class="tw"><table class="t-sm"><thead><tr><th>الموظف</th><th class="num">قطع</th><th class="num">أيام</th><th class="num">متوسط/يوم</th></tr></thead><tbody>'+ks.map(k=>'<tr><td>'+esc(k)+'</td><td class="num">'+N(e[k].p)+'</td><td class="num">'+N(Object.keys(e[k].days).length)+'</td><td class="num">'+N(e[k].o/Object.keys(e[k].days).length)+'</td></tr>').join('')+'</tbody></table></div>')+'</div>';
  const dd=Object.keys(dayEmp).sort().slice(-10).reverse();
  h+='<div style="margin-top:16px">'+card('كل يوم',dd.length?'<div class="tw"><table class="t-sm"><thead><tr><th>اليوم</th>'+ks.map(k=>'<th class="num">'+esc(k)+'</th>').join('')+'<th class="num">الإجمالي</th></tr></thead><tbody>'+dd.map(d=>'<tr><td class="mono">'+d+'</td>'+ks.map(k=>'<td class="num">'+(dayEmp[d][k]?N(dayEmp[d][k]):'<span class="muted">·</span>')+'</td>').join('')+'<td class="num"><b>'+N(Object.values(dayEmp[d]).reduce((a,v)=>a+v,0))+'</b></td></tr>').join('')+'</tbody></table></div>':'','أوردرات في اليوم')+'</div><p class="muted" style="margin-top:10px;font-size:12px">الأرقام هي عدد الأوردرات المسجّلة بالسكان. وقت السكان هو وقت رفع الملف مش وقت التغليف، فمتقيّمش بيه السرعة.</p>';
  return h;
}
function insHealth(A,C){
  const neg=D.skus.filter(k=>g(k.id,'READY')<0),drift=D.skus.filter(k=>{const b=bal()[k.id]||{};return Object.values(b).reduce((a,v)=>a+v,0)!==0});
  const dead=D.skus.filter(k=>g(k.id,'READY')>0&&!C.vel[k.id]),exc=C.velOK?D.skus.filter(k=>{const i=info(k.id);return i.cov!=null&&i.cov>S.st.excess}):[];
  let val=0,has=false;D.skus.forEach(k=>{const c=+((S.costs[k.m]||{}).cost);if(c){has=true;val+=c*total(k.id)}});
  const bk={'أقل من 3 أيام':0,'3 - 7':0,'7 - 14':0,'14 - 30':0,'أكتر من 30':0,'من غير طلب':0};
  D.skus.forEach(k=>{const i=info(k.id);if(!g(k.id,'READY')&&!i.dm)return;const c=i.cov;if(c==null)bk['من غير طلب']++;else if(c<3)bk['أقل من 3 أيام']++;else if(c<7)bk['3 - 7']++;else if(c<14)bk['7 - 14']++;else if(c<30)bk['14 - 30']++;else bk['أكتر من 30']++});
  const mxb=Math.max(1,...Object.values(bk));
  let h='<div class="kpis" style="margin-bottom:16px">'+kpi('اتزان الحركات',drift.length?N(drift.length)+' خطأ':'سليم','مجموع كل الحركات = صفر',drift.length?'crit':'good')+kpi('أصناف بالسالب',N(neg.length),'',neg.length?'crit':'good')+kpi('أصناف راكدة',N(dead.length),'رصيد ومن غير سحب',dead.length?'warn':'')+kpi('قيمة المخزون',has?N(val):'—',has?'جنيه (حسب التكلفة)':'سجّل التكلفة في الإعدادات')+'</div>';
  h+='<div class="grid g2">'+card('المخزون حسب الحالة',stateBar())+card('الأصناف حسب أيام التغطية',Object.keys(bk).map((k,i)=>hbar(k,bk[k],mxb,fmt(bk[k])+' صنف',i<2?'c':i===2?'w':'g')).join('')+(C.velOK?'':'<p class="muted" style="margin-top:8px;font-size:12px">تقديري: مبني على أيام بيانات قليلة.</p>'))+'</div>';
  h+='<div class="grid g2" style="margin-top:16px">'+card('أكبر الأصناف الراكدة',dead.length?'<div class="tw"><table class="t-sm"><tbody>'+dead.sort((a,b)=>g(b.id,'READY')-g(a.id,'READY')).slice(0,10).map(k=>'<tr data-a="sku" data-sku="'+k.id+'"><td>'+thumb(k.m,24)+' '+sw(k.c)+' '+esc(skuName(k.id))+'</td><td class="num">'+N(g(k.id,'READY'))+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">مفيش.</div>','رصيد من غير طلب')+card('زيادة عن اللازم',C.velOK?(exc.length?'<div class="tw"><table class="t-sm"><tbody>'+exc.sort((a,b)=>info(b.id).cov-info(a.id).cov).slice(0,10).map(k=>'<tr data-a="sku" data-sku="'+k.id+'"><td>'+esc(skuName(k.id))+'</td><td class="num">'+N(Math.floor(info(k.id).cov))+' يوم</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">مفيش.</div>'):'<div class="empty">بتظهر بعد 3 أيام بيانات.</div>','تغطية أكتر من '+S.st.excess+' يوم')+'</div>';
  return h;
}
