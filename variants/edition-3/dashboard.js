/* ---------- DASHBOARD: period based, built to grow with history ---------- */
const EGP=n=>fmt(Math.round(n))+' ج';
const EGPh=n=>'<span class="n">'+fmt(Math.round(n))+'</span><span class="cur">ج</span>';
const ordVal=o=>{const v=parseFloat(String(o.total==null?'':o.total).replace(/[^\d.]/g,''));return isFinite(v)?v:0};
const d2=s=>s.slice(8)+'/'+s.slice(5,7);
function dashData(){
  const C=ctx(),P=UI.insP||'all',end=S.date,cache=C._dash||(C._dash={});if(cache[P])return cache[P];
  const pkD={};S.pickups.forEach(p=>pkD[p.id]=p.date);
  let first=end;S.pickups.forEach(p=>{if(p.date<first)first=p.date});S.moves.forEach(m=>{if(m.date<first)first=m.date});
  const spanAll=Math.max(1,dayDiff(first,end)+1),N=P==='all'?spanAll:Math.max(1,+P),from=P==='all'?first:addDays(end,-(N-1));
  const pFrom=addDays(from,-N),pTo=addDays(from,-1),hasPrev=P!=='all'&&first<=pFrom,inW=(d,a,b)=>d>=a&&d<=b;
  const shipped=o=>o.sc&&o.sc.date&&(o.st==='done'||(o.st==='cx'&&o.cx&&o.cx.was==='done'));
  function metrics(a,b){
    const r={dem:0,demO:0,demV:0,ship:0,shipO:0,shipV:0,ret:0,retV:0,rcv:0,scrap:0,lost:0};
    S.orders.forEach(o=>{
      if(o.st!=='cx'){const d=pkD[o.pk];if(d&&inW(d,a,b)){r.dem+=o.lines.length;r.demO++;r.demV+=ordVal(o)}}
      if(shipped(o)&&inW(o.sc.date,a,b)){r.shipO++;r.shipV+=ordVal(o)}
      if(o.rt&&o.rt.date&&inW(o.rt.date,a,b))r.retV+=ordVal(o);
      else if(!o.rt&&o.cx&&o.cx.returned&&o.cx.date&&inW(o.cx.date,a,b))r.retV+=ordVal(o)});
    S.moves.forEach(m=>{if(!inW(m.date,a,b))return;
      if(m.type==='SCN'){if(m.from==='READY'&&m.to==='EXT_CH')r.ship+=m.q;else if(m.from==='EXT_CH'&&m.to==='READY')r.ship-=m.q}
      if(m.type==='RTN'||m.type==='CXL'){if(m.from==='EXT_CH'&&m.to==='READY')r.ret+=m.q;else if(m.from==='READY'&&m.to==='EXT_CH')r.ret-=m.q}
      if(m.type==='RCV'&&m.to==='READY')r.rcv+=m.q;
      if(m.to==='SCRAP')r.scrap+=m.q;if(m.to==='LOST')r.lost+=m.q});
    return r}
  const M=metrics(from,end),PM=hasPrev?metrics(pFrom,pTo):null;
  /* time series (daily up to 60 buckets, weekly beyond) */
  const Nc=P==='all'?Math.min(Math.max(14,spanAll),364):Math.max(14,N),step=Nc>60?7:1,nb=Math.ceil(Nc/step),bi=d=>{const k=nb-1-Math.floor(dayDiff(d,end)/step);return k>=0&&k<nb?k:-1};
  let bk=[];for(let i=0;i<nb;i++){const e=addDays(end,-(nb-1-i)*step);bk.push({s:addDays(e,-(step-1)),e,dem:0,ship:0,ret:0,shipV:0})}
  S.orders.forEach(o=>{if(o.st!=='cx'){const d=pkD[o.pk],k=d?bi(d):-1;if(k>=0)bk[k].dem+=o.lines.length}
    if(shipped(o)){const k=bi(o.sc.date);if(k>=0)bk[k].shipV+=ordVal(o)}});
  S.moves.forEach(m=>{const k=bi(m.date);if(k<0)return;
    if(m.type==='SCN'){if(m.from==='READY'&&m.to==='EXT_CH')bk[k].ship+=m.q;else if(m.from==='EXT_CH'&&m.to==='READY')bk[k].ship-=m.q}
    if(m.type==='RTN'||m.type==='CXL'){if(m.from==='EXT_CH'&&m.to==='READY')bk[k].ret+=m.q;else if(m.from==='READY'&&m.to==='EXT_CH')bk[k].ret-=m.q}});
  bk=bk.filter(b=>b.e>=first);
  /* stock level per bucket, rebuilt from the ledger (no snapshots needed) */
  const hasCosts=Object.keys(S.costs).some(m=>+((S.costs[m]||{}).cost)>0),cost=m=>+((S.costs[m]||{}).cost)||0;
  let nowR=0;D.skus.forEach(k=>nowR+=g(k.id,'READY'));
  const dl={},dlm={};S.moves.forEach(m=>{const x=(m.to==='READY'?m.q:0)-(m.from==='READY'?m.q:0);if(!x)return;dl[m.date]=(dl[m.date]||0)+x;
    if(hasCosts){const k=SKU.get(m.sku);if(k){const o=dlm[m.date]||(dlm[m.date]={});o[k.m]=(o[k.m]||0)+x}}});
  const dts=Object.keys(dl).sort(),nowM={};if(hasCosts)D.skus.forEach(k=>nowM[k.m]=(nowM[k.m]||0)+g(k.id,'READY'));
  const lvl=bk.map(b=>{let v=nowR;dts.forEach(d=>{if(d>b.e)v-=dl[d]});
    let val=null;if(hasCosts){const mm=Object.assign({},nowM);Object.keys(dlm).forEach(d=>{if(d>b.e)Object.keys(dlm[d]).forEach(m=>mm[m]=(mm[m]||0)-dlm[d][m])});val=Object.keys(mm).reduce((a,m)=>a+cost(m)*mm[m],0)}
    return {e:b.e,v,val}});
  /* top SKUs: shipped in the period, or demand when nothing was shipped yet */
  const sh={};S.moves.forEach(m=>{if(m.type!=='SCN'||!inW(m.date,from,end))return;sh[m.sku]=(sh[m.sku]||0)+(m.from==='READY'&&m.to==='EXT_CH'?m.q:m.from==='EXT_CH'&&m.to==='READY'?-m.q:0)});
  let topBy='ship',arr=Object.keys(sh).map(k=>[k,sh[k]]).filter(x=>x[1]>0);
  if(!arr.length){topBy='dem';const dd={};S.orders.forEach(o=>{if(o.st==='cx')return;const d=pkD[o.pk];if(d&&inW(d,from,end))o.lines.forEach(s=>dd[s]=(dd[s]||0)+1)});arr=Object.keys(dd).map(k=>[k,dd[k]])}
  arr.sort((a,b)=>b[1]-a[1]);const top10=arr.slice(0,10);
  /* governorates by demand in the period */
  const gv={};S.orders.forEach(o=>{if(o.st==='cx')return;const d=pkD[o.pk];if(!d||!inW(d,from,end)||!o.gov)return;const x=gv[o.gov]||(gv[o.gov]={n:0,v:0});x.n++;x.v+=ordVal(o)});
  const gov=Object.keys(gv).map(k=>({g:k,n:gv[k].n,v:gv[k].v})).sort((a,b)=>b.n-a.n);
  /* snapshot: waiting orders and stock health */
  const open=S.orders.filter(o=>o.st==='open'),blk=open.filter(o=>C.blocked[o.ref]),E=skuStats().m;
  const openV=open.reduce((a,o)=>a+ordVal(o),0),blkV=blk.reduce((a,o)=>a+ordVal(o),0);
  const oos=[];let rdAll=0,rdOos=0;D.skus.forEach(k=>{const e=E[k.id]||{rd:0},R=g(k.id,'READY'),dm=C.demand[k.id]||0;rdAll+=e.rd;if(R<=0&&(e.rd>0||dm>0)){oos.push({id:k.id,rd:e.rd,dm,R});rdOos+=e.rd}});
  oos.sort((a,b)=>b.rd-a.rd||b.dm-a.dm);
  const low=lowList().filter(x=>x[1].cls==='w').length;
  let stockV=0,lossV=0;if(hasCosts)D.skus.forEach(k=>{stockV+=cost(k.m)*g(k.id,'READY');lossV+=cost(k.m)*(g(k.id,'SCRAP')+g(k.id,'LOST'))});
  return cache[P]={P,N,from,end,first,spanAll,hasPrev,M,PM,bk,lvl,step,hasCosts,top10,topBy,gov,open,blk,openV,blkV,oos,rdAll,rdOos,low,stockV,lossV,nowR};
}
function dDelta(cur,prev,has){if(!has||!prev)return '';const p=(cur-prev)/prev;return (p>=0?'▲ ':'▼ ')+(Math.abs(p)>3?'>300':Math.abs(Math.round(p*100)))+'% عن الفترة اللي قبلها'}
function lineChart(pts,o){
  const mob=innerWidth<=820,W=mob?400:(o.W||620),Hh=mob?240:230,L=54,R=16,T=14,B=30,n=pts.length,vals=pts.map(p=>p.v),mn=Math.min(0,...vals),mx=Math.max(1,...vals),rng=(mx-mn)||1;
  const X=i=>n===1?W-R:L+i*(W-L-R)/(n-1),Y=v=>T+(1-(v-mn)/rng)*(Hh-T-B);
  let g_='';for(let k=0;k<=3;k++){const v=mn+rng*k/3,y=Y(v);g_+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="var(--grid)"/><text x="'+(L-7)+'" y="'+(y+4).toFixed(1)+'" font-size="11" text-anchor="end" fill="var(--muted)" font-family="var(--f-mono)">'+esc(o.fy(v))+'</text>'}
  const d=pts.map((p,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(p.v).toFixed(1)).join(' '),area=d+' L'+X(n-1).toFixed(1)+' '+Y(mn).toFixed(1)+' L'+X(0).toFixed(1)+' '+Y(mn).toFixed(1)+' Z';
  const lab=[0,Math.floor((n-1)/2),n-1].filter((v,i,a)=>a.indexOf(v)===i).map(i=>'<text x="'+X(i).toFixed(1)+'" y="'+(Hh-8)+'" font-size="11" text-anchor="'+(i===0?'start':i===n-1?'end':'middle')+'" fill="var(--muted)" font-family="var(--f-mono)">'+esc(pts[i].x)+'</text>').join('');
  const dots=pts.map((p,i)=>'<circle cx="'+X(i).toFixed(1)+'" cy="'+Y(p.v).toFixed(1)+'" r="'+(n<=31?3.5:0)+'" fill="'+o.c+'"/><circle cx="'+X(i).toFixed(1)+'" cy="'+Y(p.v).toFixed(1)+'" r="11" fill="transparent" data-tip="'+esc(p.tip)+'"/>').join('');
  return '<svg viewBox="0 0 '+W+' '+Hh+'" role="img" aria-label="'+esc(o.aria)+'" style="width:100%;height:auto;display:block;direction:ltr;unicode-bidi:isolate">'+g_+'<path d="'+area+'" fill="'+o.c+'" opacity=".12"/><path d="'+d+'" fill="none" stroke="'+o.c+'" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>'+dots+lab+'</svg>';
}
function dashEmpty(t){return '<div class="empty" style="padding:34px 12px">'+t+'</div>'}
function insDash(A,C){
  const Dd=dashData(),M=Dd.M,PM=Dd.PM,hp=Dd.hasPrev,pc=(a,b)=>b>0?Math.round(a/b*100)+'%':'—';
  const per=Dd.P==='all'?'كل البيانات ('+Dd.spanAll+' يوم)':Dd.P==='1'?'النهارده':'آخر '+Dd.N+' يوم';
  let h='';
  if(Dd.spanAll<14)h+='<div class="msg warn" style="margin-bottom:14px">عندنا <b>'+Dd.spanAll+' يوم</b> بيانات بس. الرسوم بتتملي يوم بيوم، ومقارنة الفترة بالفترة اللي قبلها بتظهر لما يبقى قبلها فترة كاملة. مفيش حاجة محتاج تعملها.</div>';
  h+='<div class="gh">فلوس · '+per+' <span class="muted" style="font-weight:400;letter-spacing:0">(إجمالي الأوردر شامل الشحن)</span></div><div class="kpis" style="margin-bottom:16px">'
   +kpi('مستني الشحن (قيمة)',EGPh(Dd.openV),Dd.blk.length?'واقف منه '+EGP(Dd.blkV)+' · '+Dd.blk.length+' أوردر':Dd.open.length+' أوردر',Dd.blk.length?'crit':'','instab:stuck')
   +kpi('اتشحن',EGPh(M.shipV),dDelta(M.shipV,PM&&PM.shipV,hp)||M.shipO+' أوردر','good')
   +kpi('متوسط الأوردر',(M.shipO?EGPh(M.shipV/M.shipO):'—'),PM&&PM.shipO?dDelta(M.shipV/Math.max(1,M.shipO),PM.shipV/PM.shipO,hp):'على اللي اتشحن')
   +kpi('مرتجع',EGPh(M.retV),M.shipV?pc(M.retV,M.shipV)+' من اللي اتشحن':'',M.shipV&&M.retV/M.shipV>.15?'warn':'')
   +(Dd.hasCosts?kpi('قيمة المخزون الجاهز',EGPh(Dd.stockV),'هالك + مفقود: '+EGP(Dd.lossV),Dd.lossV?'warn':''):'<button type="button" class="kpi" data-a="go" data-t="config" data-tip="ادخل تكلفة كل موديل في الإعدادات"><small>قيمة المخزون ‹</small><b style="font-size:17px">محتاج التكلفة</b><em>ادخلها في الإعدادات</em></button>')
   +'</div>';
  h+='<div class="gh">حركة القطع · '+per+'</div><div class="kpis" style="margin-bottom:16px">'
   +kpi('طلب (بيك أب)',N(M.dem),dDelta(M.dem,PM&&PM.dem,hp)||M.demO+' أوردر')
   +kpi('اتشحن',N(M.ship),dDelta(M.ship,PM&&PM.ship,hp)||'خروج فعلي','good')
   +kpi('رجع',N(M.ret),M.ship?pc(M.ret,M.ship)+' من اللي اتشحن':'',M.ship&&M.ret/M.ship>.15?'warn':'')
   +kpi('اتسلّم من المصنع (توريد)',N(M.rcv),'استلام توريد')
   +kpi('هالك ومفقود',N(M.scrap+M.lost),M.scrap+' هالك · '+M.lost+' مفقود',M.scrap+M.lost?'warn':'')
   +'</div>';
  h+='<div class="gh">صحة المخزون دلوقتي</div><div class="kpis" style="margin-bottom:16px">'
   +kpi('خلصان وعليه طلب',N(Dd.oos.length),Dd.oos.length?'ضايع تقريبًا '+fmt(Dd.oos.reduce((a,x)=>a+x.rd*7,0))+' قطعة/أسبوع':'تمام',Dd.oos.length?'crit':'good','oos:')
   +kpi('قرب يخلص',N(Dd.low),'تحت نقطة إعادة الطلب',Dd.low?'warn':'','instab:plan')
   +kpi('الطلب اللي رايح لأصناف خلصانة',Dd.rdAll>0?'<span class="n">'+Math.round(Dd.rdOos/Dd.rdAll*100)+'%</span>':'—','من معدل السحب',Dd.rdAll>0&&Dd.rdOos/Dd.rdAll>.1?'crit':'')
   +kpi('أوردرات واقفة',N(Dd.blk.length),'بسبب الرصيد',Dd.blk.length?'crit':'good','instab:stuck')
   +'</div>';
  /* charts */
  const nb=Dd.bk.length,wd=nb>16,every=Math.ceil(nb/(innerWidth<=820?4:8)),mxb=Math.max(1,...Dd.bk.map(b=>Math.max(b.dem,b.ship,0)));
  const hasFlow=Dd.bk.some(b=>b.dem>0||b.ship>0);
  const flow=hasFlow?'<div class="wk'+(wd?' dense':'')+'">'+Dd.bk.map((b,i)=>'<div class="g'+(i===nb-1?' now':'')+'" data-tip="'+(Dd.step===1?b.e:b.s+' → '+b.e)+': طلب '+fmt(b.dem)+' · اتشحن '+fmt(Math.max(0,b.ship))+(b.ret?' · رجع '+fmt(b.ret):'')+(b.shipV?' · '+EGP(b.shipV):'')+'"><span class="v">'+(!wd&&b.dem?fmt(b.dem):'')+'</span><div class="p"><i style="height:'+Math.max(2,Math.round(Math.max(0,b.dem)/mxb*150))+'px;background:var(--accent)"></i><i style="height:'+Math.max(2,Math.round(Math.max(0,b.ship)/mxb*150))+'px;background:var(--c-ready)"></i></div><span class="l">'+(i%every===0||i===nb-1?d2(b.e):'')+'</span></div>').join('')+'</div><div class="legend" style="margin-top:10px"><span><i class="dot" style="background:var(--accent)"></i>مطلوب</span><span><i class="dot" style="background:var(--c-ready)"></i>اتشحن</span><span class="muted">'+(Dd.step===7?'كل عمود أسبوع':'كل عمود يوم')+' · الأحدث على اليمين</span></div>':dashEmpty('لسه مفيش طلب ولا شحن في الفترة دي. الرسم بيتملي أول ما ترفع بيك أب وسكان.');
  const lp=Dd.lvl.map(x=>({x:d2(x.e),v:x.v,tip:x.e+': '+fmt(x.v)+' قطعة جاهزة'+(x.val!=null?' · '+EGP(x.val):'')}));
  const stockC=lp.length>=2?lineChart(lp,{c:'var(--c-ready)',fy:v=>fmt(v),aria:'مستوى المخزون الجاهز'})+'<div class="legend" style="margin-top:6px"><span class="muted">القطع الجاهزة للبيع في آخر كل '+(Dd.step===7?'أسبوع':'يوم')+'، مرجّعة من الدفتر · الأحدث على اليمين</span></div>':dashEmpty('محتاج يومين بيانات على الأقل عشان يترسم. الرصيد الحالي: <b class="n">'+fmt(Dd.nowR)+'</b> قطعة.');
  let valC='';if(Dd.hasCosts&&Dd.lvl.length>=2)valC=card('قيمة المخزون الجاهز عبر الوقت',lineChart(Dd.lvl.map(x=>({x:d2(x.e),v:x.val||0,tip:x.e+': '+EGP(x.val||0)})),{W:1200,c:'var(--accent)',fy:v=>v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?Math.round(v/1e3)+'k':String(Math.round(v)),aria:'قيمة المخزون'}),'بالتكلفة');
  const tmx=Dd.top10.length?Dd.top10[0][1]:1;
  const topC=Dd.top10.length?Dd.top10.map(x=>hbar(thumb(SKU.get(x[0]).m,22)+' '+sw(SKU.get(x[0]).c)+' '+esc(skuName(x[0])),x[1],tmx,fmt(x[1]),'',x[0])).join('')+(Dd.topBy==='dem'?'<p class="muted" style="font-size:12px;margin-top:8px">لسه مفيش شحن مسجّل في الفترة، فالترتيب حسب الطلب.</p>':''):dashEmpty('مفيش حركة في الفترة دي.');
  const gmx=Dd.gov.length?Dd.gov[0].n:1,tg=Dd.gov.slice(0,8),oth=Dd.gov.slice(8).reduce((a,x)=>a+x.n,0);
  const govC=tg.length?tg.map(x=>hbar(esc(x.g),x.n,gmx,fmt(x.n)+' · '+EGP(x.v),'g')).join('')+(oth?'<p class="muted" style="font-size:12px;margin-top:8px">+ '+(Dd.gov.length-8)+' محافظة تانية ('+fmt(oth)+' أوردر)</p>':''):dashEmpty('مفيش أوردرات في الفترة دي.');
  h+='<div class="grid g2">'+card('الطلب والشحن',flow,per)+card('مستوى المخزون الجاهز',stockC,'عبر الوقت')+'</div>';
  h+='<div class="grid g2" style="margin-top:16px">'+card('أعلى 10 أصناف '+(Dd.topBy==='ship'?'شحنًا':'طلبًا'),topC,per)+card('الأوردرات حسب المحافظة',govC,'عدد · قيمة')+'</div>';
  if(valC)h+='<div style="margin-top:16px">'+valC+'</div>';
  return h;
}
