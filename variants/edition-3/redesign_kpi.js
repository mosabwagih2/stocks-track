/* ---------- dashboard cards: every number opens a pop-up showing what is inside it ---------- */
const dkShipped=o=>o.sc&&o.sc.date&&(o.st==='done'||(o.st==='cx'&&o.cx&&o.cx.was==='done'));
function dkPer(Dd){return Dd.P==='all'?'كل البيانات ('+Dd.spanAll+' يوم)':Dd.P==='1'?'النهارده':'آخر '+Dd.N+' يوم'}
function dkOrders(list,dateOf,noteOf){
  if(!list.length)return '<div class="empty">مفيش أوردرات هنا.</div>';
  const L=list.slice(0,60);
  return '<div class="tw"><table class="t-sm"><thead><tr><th>الأوردر</th><th>المحافظة</th>'+(dateOf?'<th>التاريخ</th>':'')+'<th class="num">القيمة</th>'+(noteOf?'<th>ملاحظة</th>':'')+'</tr></thead><tbody>'+L.map(o=>'<tr data-a="order" data-ref="'+esc(o.ref)+'" style="cursor:pointer"><td><b class="mono">'+esc(o.ref)+'</b><div class="muted mono" style="font-size:11px">'+esc(o.wb||'')+'</div></td><td>'+esc(o.gov||'—')+'</td>'+(dateOf?'<td class="mono">'+esc(dateOf(o)||'')+'</td>':'')+'<td class="num"><b class="n">'+fmt(Math.round(ordVal(o)))+'</b></td>'+(noteOf?'<td>'+noteOf(o)+'</td>':'')+'</tr>').join('')+'</tbody></table></div>'+(list.length>L.length?'<p class="muted" style="font-size:12px">معروض أول '+L.length+' من '+fmt(list.length)+'. الباقي في صفحة الأوردرات.</p>':'');
}
function dkModels(map,unit,total){
  const ks=Object.keys(map).filter(k=>map[k]>0).sort((a,b)=>map[b]-map[a]);
  if(!ks.length)return '<div class="empty">مفيش حاجة في الفترة دي.</div>';
  const t=total||ks.reduce((a,k)=>a+map[k],0);
  return '<div class="tw"><table class="t-sm"><thead><tr><th>الموديل</th><th class="num">'+unit+'</th><th class="num">النسبة</th></tr></thead><tbody>'+ks.map(k=>'<tr><td><span class="row" style="gap:8px;flex-wrap:nowrap">'+thumb(k,28)+'<b>'+esc(mName(k))+'</b></span></td><td class="num"><b class="n">'+fmt(Math.round(map[k]))+'</b></td><td class="num muted">'+Math.round(map[k]/t*100)+'%</td></tr>').join('')+'</tbody></table></div>';
}
function dkMoves(Dd,pred){
  const r={};S.moves.forEach(m=>{if(m.date<Dd.from||m.date>Dd.end)return;const x=pred(m);if(!x)return;const k=SKU.get(m.sku);if(!k)return;r[k.m]=(r[k.m]||0)+x});return r;
}
function dkSheet(s){
  const Dd=dashData(),M=Dd.M,per=dkPer(Dd),inW=d=>d>=Dd.from&&d<=Dd.end,strip=a=>'<div class="kpis">'+a.map(x=>'<div class="kpi '+(x[3]||'')+'"><small>'+x[0]+'</small><b>'+x[1]+'</b>'+(x[2]?'<em>'+x[2]+'</em>':'')+'</div>').join('')+'</div>';
  const note=t=>'<p class="muted" style="font-size:12.5px">'+t+'</p>';
  let title='',body='';
  const k=s.k;
  if(k==='open'){
    const C=ctx(),os=Dd.open.slice().sort((a,b)=>(C.blocked[b.ref]?1:0)-(C.blocked[a.ref]?1:0)||ordVal(b)-ordVal(a));
    title='أوردرات مستنية الشحن ('+os.length+')';
    body=strip([['القيمة',EGPh(Dd.openV),os.length+' أوردر'],['معطّل',EGPh(Dd.blkV),Dd.blk.length+' أوردر',Dd.blk.length?'crit':'']])+note('الأوردرات اللي اتطلبت ولسه ما اتسكنتش. "معطّل" يعني فيه قطعة ناقصة في الرصيد.')+dkOrders(os,null,o=>C.blocked[o.ref]?pill('crit','معطّل'):pill('good','جاهز'))+(Dd.blk.length?'<div class="row" style="margin-top:8px"><button class="btn" data-a="dkstuck">افتح تبويب الأوردرات الواقفة</button></div>':'');
  }else if(k==='shipv'){
    const os=S.orders.filter(o=>dkShipped(o)&&inW(o.sc.date)).sort((a,b)=>(b.sc.date>a.sc.date?1:-1)||ordVal(b)-ordVal(a)),gv={};
    os.forEach(o=>{const g_=o.gov||'غير محدد',x=gv[g_]||(gv[g_]={n:0,v:0});x.n++;x.v+=ordVal(o)});
    title='اتشحن · '+per;
    body=strip([['القيمة',EGPh(M.shipV),M.shipO+' أوردر','good'],['المتوسط',M.shipO?EGPh(M.shipV/M.shipO):'—','للأوردر']])+(Object.keys(gv).length?'<div class="gh">حسب المحافظة</div><div class="tw"><table class="t-sm"><tbody>'+Object.keys(gv).sort((a,b)=>gv[b].v-gv[a].v).slice(0,8).map(g_=>'<tr><td>'+esc(g_)+'</td><td class="num">'+fmt(gv[g_].n)+' أوردر</td><td class="num"><b class="n">'+fmt(Math.round(gv[g_].v))+'</b> ج</td></tr>').join('')+'</tbody></table></div>':'')+'<div class="gh">الأوردرات</div>'+dkOrders(os,o=>o.sc.date);
  }else if(k==='avg'){
    const os=S.orders.filter(o=>dkShipped(o)&&inW(o.sc.date)),vs=os.map(ordVal).sort((a,b)=>a-b),med=vs.length?vs[Math.floor(vs.length/2)]:0;
    title='متوسط الأوردر · '+per;
    body=strip([['المتوسط',M.shipO?EGPh(M.shipV/M.shipO):'—',M.shipO+' أوردر'],['الوسيط',EGPh(med),'نص الأوردرات أقل منه'],['أصغر',EGPh(vs[0]||0)],['أكبر',EGPh(vs[vs.length-1]||0)]])+note('بيتحسب على الأوردرات اللي اتشحنت في الفترة بس، وبالقيمة الكاملة شامل الشحن.')+'<div class="gh">أكبر الأوردرات</div>'+dkOrders(os.sort((a,b)=>ordVal(b)-ordVal(a)).slice(0,10),o=>o.sc.date);
  }else if(k==='retv'){
    const os=S.orders.filter(o=>(o.rt&&o.rt.date&&inW(o.rt.date))||(!o.rt&&o.cx&&o.cx.returned&&o.cx.date&&inW(o.cx.date))).sort((a,b)=>ordVal(b)-ordVal(a));
    title='مرتجع · '+per;
    body=strip([['القيمة',EGPh(M.retV),M.shipV?Math.round(M.retV/M.shipV*100)+'% من اللي اتشحن':'',M.retV?'warn':''],['أوردرات',N(os.length)]])+dkOrders(os,o=>(o.rt&&o.rt.date)||(o.cx&&o.cx.date),o=>o.rt?'مرتجع':'اتلغى ورجع');
  }else if(k==='stockv'){
    const cost=m=>+((S.costs[m]||{}).cost)||0,rows={},loss={};
    D.skus.forEach(x=>{rows[x.m]=(rows[x.m]||0)+cost(x.m)*g(x.id,'READY');loss[x.m]=(loss[x.m]||0)+cost(x.m)*(g(x.id,'SCRAP')+g(x.id,'LOST'))});
    title='قيمة المخزون الجاهز';
    body=strip([['القيمة (بالتكلفة)',EGPh(Dd.stockV),fmt(Dd.nowR)+' قطعة جاهزة'],['هالك + مفقود',EGPh(Dd.lossV),'بالتكلفة',Dd.lossV?'warn':'']])+'<div class="gh">حسب الموديل (ج)</div>'+dkModels(rows,'القيمة');
  }else if(k==='dem'){
    const mm={},pk=S.pickups.filter(p=>p.date>=Dd.from&&p.date<=Dd.end).slice().reverse(),pkS={};
    S.orders.forEach(o=>{if(o.st==='cx')return;const p=pk.find(x=>x.id===o.pk);if(!p)return;const x=pkS[p.id]||(pkS[p.id]={n:0,q:0});x.n++;x.q+=o.lines.length;o.lines.forEach(sk=>{const q=SKU.get(sk);if(q)mm[q.m]=(mm[q.m]||0)+1})});
    title='طلب (بيك أب) · '+per;
    body=strip([['قطع',N(M.dem),M.demO+' أوردر']])+'<div class="gh">حسب البيك أب</div>'+(pk.length?'<div class="tw"><table class="t-sm"><thead><tr><th>البيك أب</th><th>التاريخ</th><th class="num">أوردرات</th><th class="num">قطع</th></tr></thead><tbody>'+pk.map(p=>'<tr><td><b>'+esc(p.label)+'</b></td><td class="mono">'+esc(p.date)+'</td><td class="num">'+fmt((pkS[p.id]||{n:0}).n)+'</td><td class="num"><b class="n">'+fmt((pkS[p.id]||{q:0}).q)+'</b></td></tr>').join('')+'</tbody></table></div>':'<div class="empty">مفيش بيك أب في الفترة دي.</div>')+'<div class="gh">حسب الموديل</div>'+dkModels(mm,'قطع');
  }else if(k==='ship'){
    title='اتشحن (قطع) · '+per;
    body=strip([['قطع',N(M.ship),'خروج فعلي بالسكان','good']])+'<div class="gh">حسب الموديل</div>'+dkModels(dkMoves(Dd,m=>m.type==='SCN'?(m.from==='READY'&&m.to==='EXT_CH'?m.q:m.from==='EXT_CH'&&m.to==='READY'?-m.q:0):0),'قطع');
  }else if(k==='ret'){
    title='رجع (قطع) · '+per;
    body=strip([['قطع',N(M.ret),M.ship?Math.round(M.ret/M.ship*100)+'% من اللي اتشحن':'',M.ret?'warn':'']])+'<div class="gh">حسب الموديل</div>'+dkModels(dkMoves(Dd,m=>(m.type==='RTN'||m.type==='CXL')?(m.from==='EXT_CH'&&m.to==='READY'?m.q:m.from==='READY'&&m.to==='EXT_CH'?-m.q:0):0),'قطع');
  }else if(k==='rcv'){
    const ds=S.docs.filter(d=>d.type==='RCV'&&d.status==='done'&&d.date>=Dd.from&&d.date<=Dd.end).slice().reverse();
    title='اتسلّم من المصنع · '+per;
    body=strip([['قطع',N(M.rcv),ds.length+' استلام']])+'<div class="gh">حسب الموديل</div>'+dkModels(dkMoves(Dd,m=>m.type==='RCV'&&m.to==='READY'?m.q:0),'قطع')+'<div class="gh">عمليات الاستلام</div>'+(ds.length?'<div class="tw"><table class="t-sm"><thead><tr><th>الرقم</th><th>التاريخ</th><th class="num">قطع</th></tr></thead><tbody>'+ds.map(d=>'<tr data-a="opendoc2" data-id="'+d.id+'" style="cursor:pointer"><td><b class="mono">'+esc(d.no||'')+'</b></td><td class="mono">'+esc(d.date)+'</td><td class="num"><b class="n">'+fmt(d.lines.reduce((a,l)=>a+num(l.q),0))+'</b></td></tr>').join('')+'</tbody></table></div>':'<div class="empty">مفيش استلام في الفترة دي.</div>');
  }else if(k==='loss'){
    const ms=S.moves.filter(m=>(m.to==='SCRAP'||m.to==='LOST')&&m.date>=Dd.from&&m.date<=Dd.end).slice().reverse();
    title='هالك ومفقود · '+per;
    body=strip([['هالك',N(M.scrap),'',M.scrap?'warn':''],['مفقود',N(M.lost),'',M.lost?'warn':'']])+'<div class="gh">حسب الموديل</div>'+dkModels(dkMoves(Dd,m=>(m.to==='SCRAP'||m.to==='LOST')?m.q:0),'قطع')+'<div class="gh">الحركات</div>'+(ms.length?'<div class="tw"><table class="t-sm"><thead><tr><th>التاريخ</th><th>الصنف</th><th>النوع</th><th class="num">قطع</th></tr></thead><tbody>'+ms.slice(0,60).map(m=>'<tr data-a="sku" data-sku="'+esc(m.sku)+'" style="cursor:pointer"><td class="mono">'+esc(m.date)+'</td><td>'+esc(skuName(m.sku))+'<div class="muted" style="font-size:11px">'+esc(m.note||m.doc||'')+'</div></td><td>'+(m.to==='SCRAP'?pill('warn','هالك'):pill('lost','مفقود'))+'</td><td class="num"><b class="n">'+fmt(m.q)+'</b></td></tr>').join('')+'</tbody></table></div>'+(ms.length>60?'<p class="muted" style="font-size:12px">معروض أحدث 60 من '+ms.length+'. الباقي في السجل.</p>':''):'<div class="empty">مفيش هالك أو مفقود في الفترة دي.</div>');
  }
  return {title,body};
}
const ACT_DK={dkstuck:()=>{UI.sheet=null;UI.ins='stuck';render()},dk:el=>{UI.sheet={kind:'dk',k:el.dataset.v};render()}};
