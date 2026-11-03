import pathlib
H=pathlib.Path(__file__).parent;T=H/'.work'
s=(T/'state.html').read_text(encoding='utf-8')
def rep(a,b):
    global s
    assert s.count(a)==1,(a[:70],s.count(a))
    s=s.replace(a,b)

rep(".hb{display:grid;",""".hb .tr.m{position:relative;overflow:visible}
.hb .tr.m b{position:absolute;inset-inline-start:var(--x);top:-4px;bottom:-4px;width:2px;background:var(--ink);border-radius:2px;opacity:.7}
.wk{display:flex;align-items:flex-end;gap:10px;padding-top:6px}
.wk .g{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:4px}
.wk .p{display:flex;align-items:flex-end;gap:3px;height:150px}
.wk .p i{display:block;width:16px;border-radius:6px 6px 2px 2px;min-height:2px}
.wk .l{font:500 11px var(--f-mono);color:var(--muted);white-space:nowrap}
.wk .v{font:500 11px var(--f-mono)}
.wk .g.now .l{color:var(--ink);font-weight:700}
.hb{display:grid;""")

rep("const INS_TABS=[['over','نظرة عامة'],","const INS_TABS=[['over','نظرة عامة'],['rate','معدل السحب'],")
rep("h+=({over:insOver,demand:insDemand,","h+=({over:insOver,rate:insRate,demand:insDemand,")

rep("""<input type="number" min="0" value="'+S.st[f]+'" data-c="st" data-f="'+f+'">""","""<input type="number" min="0" value="'+rv(f)+'" data-c="st" data-f="'+f+'">""")
rep("stf('excess','زيادة عن اللازم بعد','يوم')+'</div></section>'","stf('excess','زيادة عن اللازم بعد','يوم')+stf('leadW','مهلة المصنع (من الطلب للاستلام)','أسبوع')+stf('svc','مستوى الخدمة','%')+stf('safeW','أمان بديل (أقل من 7 أيام بيانات)','أسبوع')+stf('tgtW','نصنّع لحد تغطية','أسبوع')+'</div><p class=\"muted\" style=\"margin-top:8px;font-size:12px\">المهلة والأمان والهدف بيتستخدموا في تاب \"معدل السحب\" في التحليلات.</p></section>'")

code=r"""/* ---------- WEEKLY WITHDRAWAL RATE ---------- */
const RATE_DEF={leadW:2,safeW:1,tgtW:4,svc:95};
function zOf(p){p=Math.min(99.9,Math.max(50,+p||95))/100;const q=1-p,t=Math.sqrt(-2*Math.log(q));return t-(2.515517+0.802853*t+0.010328*t*t)/(1+1.432788*t+0.189269*t*t+0.001308*t*t*t)}
function rv(k){return S.st[k]!=null?S.st[k]:RATE_DEF[k]}
function rateData(){
  const end=S.date,NW=8,MAXD=28,pkD={};S.pickups.forEach(p=>pkD[p.id]=p.date);
  const wi=d=>{const k=Math.floor(dayDiff(d,end)/7);return(k>=0&&k<NW)?NW-1-k:-1};
  const dem=Array(NW).fill(0),shp=Array(NW).fill(0),M={};let first=null;
  const mm=m=>M[m]||(M[m]={daily:Array(MAXD).fill(0),out:0,inflow:0,net:0});
  S.orders.forEach(o=>{if(o.st==='cx')return;const d=pkD[o.pk];if(!d)return;const age=dayDiff(d,end);if(age<0)return;if(first===null||d<first)first=d;
    const w=wi(d);if(w>=0)dem[w]+=o.lines.length;
    if(age<MAXD)o.lines.forEach(sk=>{const k=SKU.get(sk);if(k)mm(k.m).daily[age]++})});
  S.moves.forEach(m=>{const w=wi(m.date);if(w<0)return;const k=SKU.get(m.sku);
    if(m.type==='SCN'){const q=m.from==='READY'?m.q:m.to==='READY'?-m.q:0;shp[w]+=q;if(w===NW-1&&k)mm(k.m).out+=q}
    if(w===NW-1&&k){if(m.to==='READY'){mm(k.m).inflow+=m.q;mm(k.m).net+=m.q}if(m.from==='READY')mm(k.m).net-=m.q}});
  const span=first===null?0:Math.min(MAXD,Math.max(1,dayDiff(first,end)+1)),avail=Math.min(7,span);
  const lead=+rv('leadW'),safe=+rv('safeW'),tgt=+rv('tgtW'),z=zOf(rv('svc')),Ld=lead*7;
  let ws=0;for(let i=0;i<span;i++)ws+=Math.pow(.5,i/7);
  const rows=MORDER.map(m=>{const x=M[m]||{daily:Array(MAXD).fill(0),out:0,inflow:0,net:0},dl=x.daily.slice(0,span),ready=mSum(m,'READY'),fac=mSum(m,'FACTORY'),pos=ready+fac;
    let wsum=0;dl.forEach((v,i)=>wsum+=v*Math.pow(.5,i/7));const rate=span?7*wsum/ws:0;
    const cur=dl.slice(0,7).reduce((a,v)=>a+v,0),prev=dl.slice(7,14).reduce((a,v)=>a+v,0);
    const mean=span?dl.reduce((a,v)=>a+v,0)/span:0,sd=span>=7?Math.sqrt(dl.reduce((a,v)=>a+(v-mean)*(v-mean),0)/(span-1)):null;
    const ss=rate>0?(sd!=null?z*sd*Math.sqrt(Ld):safe*rate):0,cv=(span>=14&&mean>0)?sd/mean:null,xyz=cv==null?null:cv<=.5?'X':cv<=1?'Y':'Z';
    const begin=ready-x.net,den=begin+x.inflow,st=den>0?Math.max(0,x.out)/den:null;
    const cover=rate>0?ready/rate:null,coverAll=rate>0?pos/rate:null,rop=rate*lead+ss,need=rate>0?Math.max(0,Math.ceil(rate*(lead+tgt)+ss-pos)):0;
    const trend=(span>=14&&prev>0)?(cur-prev)/prev:null,ssw=rate>0?ss/rate:0;
    let k='good',label='تمام';
    if(rate>0&&pos<=rop){k='crit';label='اطلب تصنيع دلوقتي'}
    else if(rate>0&&cover<lead+ssw){k='warn';label='هيخلص قبل ما الجديد يوصل'}
    else if(rate>0&&coverAll*7>S.st.excess){k='info';label='أكتر من اللازم'}
    else if(rate===0&&ready>0){k='';label='مفيش سحب'}
    else if(rate===0){k='';label='—'}
    return {m,rate,prev,trend,ready,fac,cover,coverAll,rop,ss,need,st,den,cv,xyz,abc:(ctx().abc||{})[m]||'',out:Math.max(0,x.out),k,label}});
  return {NW,dem,shp,rows,avail,span,end,lead,safe,tgt,z,svc:+rv('svc'),tot:rows.reduce((a,r)=>a+r.rate,0),totReady:rows.reduce((a,r)=>a+r.ready,0)};
}
function insRate(){
  const R=rateData(),rows=R.rows.filter(r=>r.rate>0||r.ready>0);
  if(!R.avail)return '<div class="card"><div class="empty">مفيش بيانات طلب لحد دلوقتي. ارفع بيك أب وبعدها الأرقام هتظهر هنا.</div></div>';
  const fw=(n)=>n==null?'—':(n>=99?'99+':n.toFixed(1)),pc=v=>v==null?'—':Math.round(v*100)+'%',wf=n=>fmt(n);
  const cur=R.dem[R.NW-1],prv=R.dem[R.NW-2],tr=R.span>=14&&prv>0?(cur-prv)/prv:null;
  const stOut=R.shp[R.NW-1],stDen=R.rows.reduce((a,r)=>a+Math.max(0,r.den),0),stAll=stDen>0?stOut/stDen:null;
  const nCrit=R.rows.filter(r=>r.k==='crit').length,nWarn=R.rows.filter(r=>r.k==='warn').length,totNeed=R.rows.reduce((a,r)=>a+r.need,0);
  let h='';
  if(R.span<14)h+='<div class="msg warn" style="margin-bottom:14px">عندنا <b>'+R.span+' يوم</b> بيانات طلب بس. المعدل الأسبوعي تقدير (متوسط اليوم × 7)'+(R.span<7?'، ومخزون الأمان بيتحسب بالقيمة البديلة من الإعدادات لأن الانحراف المعياري محتاج 7 أيام على الأقل':'')+'. الاتجاه وثبات الطلب بيظهروا بعد 14 يوم.</div>';
  h+='<div class="kpis" style="margin-bottom:16px">'+kpi('سحب أسبوعي (طلب)',N(Math.round(R.tot)),R.span<14?'تقدير من '+R.span+' يوم':(tr==null?'':(tr>=0?'▲ ':'▼ ')+Math.abs(Math.round(tr*100))+'% عن الأسبوع اللي فات'))+kpi('تغطية المخزون الجاهز','<span class="n">'+fw(R.tot>0?R.totReady/R.tot:null)+'</span>','أسبوع بمعدل السحب ده')+kpi('Sell-through الأسبوع',stAll==null?'—':'<span class="n">'+pc(stAll)+'</span>','اتشحن ÷ (أول الأسبوع + اللي دخل)')+kpi('محتاج تصنيع دلوقتي',N(nCrit),nWarn?nWarn+' كمان قربوا':'موديل',nCrit?'crit':nWarn?'warn':'good')+kpi('كمية مقترحة',N(totNeed),'قطعة لهدف '+R.tgt+' أسابيع',totNeed?'warn':'')+'</div>';
  // chart 1
  const mx=Math.max(1,...R.dem,...R.shp.map(v=>Math.max(0,v))),ph=v=>Math.max(2,Math.round(Math.max(0,v)/mx*150));
  const wk='<div class="wk">'+R.dem.map((d,i)=>{const s=addDays(R.end,-(7*(R.NW-i)-1));const sh=Math.max(0,R.shp[i]);return '<div class="g'+(i===R.NW-1?' now':'')+'" data-tip="أسبوع يبدأ '+s+': طلب '+fmt(d)+' · اتشحن '+fmt(sh)+'"><span class="v">'+(d?fmt(d):'')+'</span><div class="p"><i style="height:'+ph(d)+'px;background:var(--accent)"></i><i style="height:'+ph(sh)+'px;background:var(--c-ready)"></i></div><span class="l">'+s.slice(8)+'/'+s.slice(5,7)+'</span></div>'}).join('')+'</div><div class="legend" style="margin-top:10px"><span><i class="dot" style="background:var(--accent)"></i>مطلوب (بيك أب)</span><span><i class="dot" style="background:var(--c-ready)"></i>اتشحن فعلًا (سكان)</span><span class="muted">العمود الأحدث على الشمال (آخر 7 أيام لحد '+R.end+')</span></div>';
  h+=card('السحب الأسبوعي · آخر '+R.NW+' أسابيع',wk,'قطع في الأسبوع');
  // chart 2: cover vs lead
  const top=rows.filter(r=>r.rate>0).sort((a,b)=>b.rate-a.rate).slice(0,12),AX=12,sw=top.length?top.reduce((a,r)=>a+(r.rate>0?r.ss/r.rate:0),0)/top.length:R.safe,mk=((R.lead+sw)/AX*100).toFixed(1);
  const cov=top.length?top.map(r=>{const w=r.cover==null?0:r.cover;return '<div class="hb" data-tip="'+esc(r.m)+': جاهز '+fmt(r.ready)+' · عند المصنع '+fmt(r.fac)+' · سحب '+fmt(r.rate)+'/أسبوع"><span class="nm"><b class="mono">'+esc(r.m)+'</b></span><div class="tr m" style="--x:'+mk+'%"><i class="'+(w<R.lead?'c':w<R.lead+(r.rate>0?r.ss/r.rate:0)?'w':'g')+'" style="width:'+Math.max(2,Math.min(100,w/AX*100)).toFixed(1)+'%"></i><b></b></div><span class="v">'+fw(r.cover)+'</span></div>'}).join('')+'<div class="legend" style="margin-top:10px"><span><i class="dot" style="background:var(--c-scrap)"></i>أقل من مهلة المصنع</span><span><i class="dot" style="background:var(--c-dirty)"></i>أقل من المهلة + أمان الموديل</span><span><i class="dot" style="background:var(--c-ready)"></i>كفاية</span><span class="muted">الخط الأسود = المهلة ('+R.lead+') + متوسط الأمان ('+sw.toFixed(1)+') أسبوع · المحور لحد '+AX+' أسبوع</span></div>':'<div class="empty">مفيش موديلات عليها سحب.</div>';
  const stl=R.rows.filter(r=>r.st!=null&&r.out>0).sort((a,b)=>b.st-a.st).slice(0,12),smx=Math.max(.01,...stl.map(r=>r.st));
  const sth=stl.length?stl.map(r=>hbar('<b class="mono">'+esc(r.m)+'</b>',r.st,smx,pc(r.st),r.st>=.4?'g':r.st<.1?'w':'',fmt(r.out)+' قطعة اتشحنت')).join('')+'<p class="muted" style="font-size:12px;margin-top:8px">Sell-through عالي مع تغطية قصيرة معناه الموديل ممكن يخلص. وطويل مع تغطية كبيرة معناه راكد.</p>':'<div class="empty">لسه مفيش شحن في آخر 7 أيام.</div>';
  h+='<div class="grid g2" style="margin-top:16px">'+card('التغطية بالأسابيع مقابل مهلة المصنع',cov,'أعلى 12 موديل سحبًا')+card('Sell-through الأسبوع ده',sth,'أعلى 12 موديل')+'</div>';
  // table
  const arrow=t=>t==null?'<span class="muted">—</span>':(t>=0?'<span style="color:var(--good)">▲ ':'<span style="color:var(--crit)">▼ ')+Math.abs(Math.round(t*100))+'%</span>';
  const tb=rows.slice().sort((a,b)=>({crit:0,warn:1,info:2,good:3,'':4}[a.k]-{crit:0,warn:1,info:2,good:3,'':4}[b.k])||b.rate-a.rate).map(r=>'<tr><td><b class="mono">'+esc(r.m)+'</b> <span class="muted" style="font-size:12px">'+esc(MODEL.get(r.m)?MODEL.get(r.m).name:'')+'</span></td><td class="num">'+N(Math.round(r.rate))+'</td><td class="num">'+arrow(r.trend)+'</td><td class="num">'+N(r.ready)+'</td><td class="num">'+N(r.fac)+'</td><td class="num">'+fw(r.cover)+'</td><td class="num"'+(r.rate>0?' data-tip="مخزون الأمان '+fmt(r.ss)+' قطعة"':'')+'>'+(r.rate>0?N(Math.round(r.rop)):'—')+'</td><td class="num">'+(r.need?pill('warn',fmt(r.need)):'<span class="muted">0</span>')+'</td><td class="num">'+pc(r.st)+'</td><td class="num"'+(r.cv!=null?' data-tip="معامل التذبذب '+r.cv.toFixed(2)+'"':'')+'>'+(r.xyz?'<span class="pill'+(r.xyz==='X'?' good':r.xyz==='Y'?' warn':' crit')+'">'+(r.abc||'')+r.xyz+'</span>':'<span class="muted">—</span>')+'</td><td>'+(r.label==='—'?'':pill(r.k,r.label))+'</td></tr>').join('');
  h+='<div style="margin-top:16px">'+card('كل الموديلات','<div class="tw"><table class="t-sm"><thead><tr><th>الموديل</th><th class="num">سحب/أسبوع</th><th class="num">الاتجاه</th><th class="num">جاهز</th><th class="num">عند المصنع</th><th class="num">تغطية (أسبوع)</th><th class="num">نقطة الطلب</th><th class="num">مقترح تصنيع</th><th class="num">Sell-through</th><th class="num">الثبات</th><th>الحالة</th></tr></thead><tbody>'+tb+'</tbody></table></div>','مرتّبة بالأخطر')+'</div>';
  // formulas
  h+='<details class="dd" style="margin-top:16px"><summary><b>المعادلات بتتحسب إزاي</b><span class="muted" style="font-size:12px">مهلة المصنع '+R.lead+' أسبوع · مستوى الخدمة '+R.svc+'% (Z='+R.z.toFixed(2)+') · هدف '+R.tgt+' أسابيع</span></summary><div style="padding:0 16px 16px;display:grid;gap:10px">'+[
   ['معدل السحب الأسبوعي','7 × Σ (طلب اليوم × 0.5^(عمر اليوم ÷ 7)) ÷ Σ 0.5^(عمر اليوم ÷ 7)  على آخر 28 يوم (أو المتاح)','متوسط مرجّح بنص عمر 7 أيام: آخر أسبوع وزنه أكبر، فبيلحق الزيادة أسرع من المتوسط العادي اللي بيتأخر لما الطلب بيطلع. بنقيسه على الطلب (البيك أب) مش الشحن، عشان لو الصنف خلص مبيتحسبش إن مفيش سحب.'],
   ['الاتجاه','(آخر 7 أيام − الـ 7 اللي قبلهم) ÷ اللي قبلهم','بيظهر بعد 14 يوم بيانات بس، عشان مقارنة أسبوع كامل بنص أسبوع بتديك رقم غلط.'],
   ['أسابيع التغطية','الجاهز للبيع ÷ معدل السحب الأسبوعي','كام أسبوع الرصيد هيكفي لو السحب فضل زي ما هو. مبتاخدش المهلة في الحسبان، فبتتقري مع نقطة الطلب.'],
   ['مخزون الأمان','Z × σ الطلب اليومي × √(مهلة المصنع بالأيام)','Z حسب مستوى الخدمة (95% = 1.65). σ هو الانحراف المعياري للطلب اليومي للموديل. لو أقل من 7 أيام بيانات بنستخدم القيمة البديلة (أسبوع × المعدل). المعادلة دي بتفترض إن المهلة ثابتة.'],
   ['نقطة إعادة الطلب','معدل السحب الأسبوعي × المهلة (أسابيع) + مخزون الأمان','لو (الجاهز + اللي عند المصنع) نزل تحتها، اطلب تصنيع.'],
   ['الكمية المقترحة','معدل السحب × (المهلة + هدف التغطية) + مخزون الأمان − (الجاهز + عند المصنع)','متقفلة على صفر لو الرصيد كفاية.'],
   ['Sell-through','اللي اتشحن في الأسبوع ÷ (جاهز أول الأسبوع + اللي دخل الجاهز في الأسبوع)','المصادر مختلفة على المقام: في اللي بيستخدم رصيد أول المدة بس، وفي اللي بيستخدم المستلم بس. استخدمنا أول المدة + الداخل لأنه الأنسب لما التوريد بيحصل أثناء الأسبوع.'],
   ['الثبات (XYZ)','معامل التذبذب CV = σ الطلب اليومي ÷ متوسطه','X لو CV ≤ 0.5، Y لو ≤ 1، وZ لو أكتر. الحدود دي مش معيار واحد (المصادر بتختلف) وهي على الطلب اليومي، فعايزة تتظبط على بياناتك. الحرف اللي قبل X/Y/Z هو ABC من حصة الطلب.']
  ].map(f=>'<div class="insn" style="grid-template-columns:1fr"><span><b>'+f[0]+'</b><br><span class="mono" style="direction:rtl;display:inline-block;margin:2px 0">'+f[1]+'</span><br><span class="muted" style="font-size:13px">'+f[2]+'</span></span></div>').join('')+'</div></details>';
  return h;
}
function insOver(A,C){"""
rep("function insOver(A,C){",code)

rep("(ctx().demand[k.id]||0):0),0))+'</span></span></div></div>'+'<span class=\"row\">'","(ctx().demand[k.id]||0):0),0))+'</span></span>'+rateChip(m.code)+'</div></div>'+'<span class=\"row\">'")
rep(".hb .tr.m{position:relative;overflow:visible}",".ratechip{all:unset;cursor:pointer;display:inline-block;margin-top:4px;font-size:13px;color:var(--muted);border-radius:8px}\n.ratechip:hover{color:var(--accent)}\n.ratechip:focus-visible{outline:2px solid var(--accent);outline-offset:2px}\n.hb .tr.m{position:relative;overflow:visible}")
rep("function insRate(){","""function rateChip(m){
  const C=ctx(),R=C._rate||(C._rate=rateData()),r=R.rows.find(x=>x.m===m);if(!r)return '';
  const est=R.span<7,tip='سحب أسبوعي محسوب من الطلب (بيك أب) بمتوسط مرجّح. '+(est?'تقدير من '+R.span+' يوم بيانات. ':'')+'اضغط للتفاصيل في التحليلات.';
  if(!(r.rate>0))return '<br><button type="button" class="ratechip" data-a="ratejump" data-tip="'+tip+'">مفيش سحب في آخر فترة</button>';
  const flag=r.k==='crit'?pill('crit','اطلب تصنيع'):r.k==='warn'?pill('warn','هيخلص قبل ما الجديد يوصل'):r.k==='info'?pill('info','أكتر من اللازم'):'';
  return '<br><button type="button" class="ratechip" data-a="ratejump" data-tip="'+tip+'">سحب <b class="n">'+(est?'~':'')+fmt(r.rate)+'</b>/أسبوع · تغطية <b class="n">'+(r.cover>=99?'99+':r.cover.toFixed(1))+'</b> أسبوع '+flag+'</button>';
}
function insRate(){""")
rep("  state:el=>{UI.sheet={kind:'state',l:el.dataset.l};render()},","  state:el=>{UI.sheet={kind:'state',l:el.dataset.l};render()},\n  ratejump:()=>{UI.ins='rate';go('insights')},")

(T/'state2.html').write_text(s,encoding='utf-8')
