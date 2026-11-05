/* ---------- v2: merged analytics (4 tabs): each number lives in one place ---------- */
function insStockPlan(A,C){
  return insPlan2(A,C)+stockHealthExtras(C);
}
function stockHealthExtras(C){
  const neg=D.skus.filter(k=>g(k.id,'READY')<0),drift=D.skus.filter(k=>{const b=bal()[k.id]||{};return Object.values(b).reduce((a,v)=>a+v,0)!==0});
  const dead=D.skus.filter(k=>g(k.id,'READY')>0&&!C.vel[k.id]),exc=C.velOK?D.skus.filter(k=>{const i=info(k.id);return i.cov!=null&&i.cov>S.st.excess}):[];
  const bk={'أقل من 3 أيام':0,'3 - 7':0,'7 - 14':0,'14 - 30':0,'أكتر من 30':0,'من غير طلب':0};
  D.skus.forEach(k=>{const i=info(k.id);if(!g(k.id,'READY')&&!i.dm)return;const c=i.cov;if(c==null)bk['من غير طلب']++;else if(c<3)bk['أقل من 3 أيام']++;else if(c<7)bk['3 - 7']++;else if(c<14)bk['7 - 14']++;else if(c<30)bk['14 - 30']++;else bk['أكتر من 30']++});
  const mxb=Math.max(1,...Object.values(bk));
  let h='<div class="gh" style="margin-top:26px">صحة المخزون</div>';
  if(drift.length)h+='<div class="msg crit" style="margin-bottom:12px"><b>خطأ في اتزان الحركات في '+drift.length+' صنف.</b> مجموع حركات الصنف لازم يساوي صفر.</div>';
  if(neg.length)h+='<div class="msg crit" style="margin-bottom:12px"><b>'+neg.length+' صنف رصيده بالسالب.</b> اعمل جرد وصحّحه.</div>';
  h+='<div class="grid g2">'+card('الأصناف حسب أيام التغطية',Object.keys(bk).map((k,i)=>hbar(k,bk[k],mxb,fmt(bk[k])+' صنف',i<2?'c':i===2?'w':'g')).join('')+(C.velOK?'':'<p class="muted" style="margin-top:8px;font-size:12px">تقديري: مبني على أيام بيانات قليلة.</p>'))
   +card('زيادة عن اللازم',C.velOK?(exc.length?'<div class="tw"><table class="t-sm"><tbody>'+exc.sort((a,b)=>info(b.id).cov-info(a.id).cov).slice(0,10).map(k=>'<tr data-a="sku" data-sku="'+k.id+'"><td>'+esc(skuName(k.id))+'</td><td class="num">'+N(Math.floor(info(k.id).cov))+' يوم</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">مفيش.</div>'):'<div class="empty">بتظهر بعد 3 أيام بيانات.</div>','تغطية أكتر من '+S.st.excess+' يوم')+'</div>';
  h+='<div style="margin-top:16px">'+card('أكبر الأصناف الراكدة ('+fmt(dead.length)+' صنف)',dead.length?'<div class="tw"><table class="t-sm"><tbody>'+dead.sort((a,b)=>g(b.id,'READY')-g(a.id,'READY')).slice(0,10).map(k=>'<tr data-a="sku" data-sku="'+k.id+'"><td>'+thumb(k.m,24)+' '+sw(k.c)+' '+esc(skuName(k.id))+'</td><td class="num">'+N(g(k.id,'READY'))+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">مفيش.</div>','رصيد من غير طلب')+'</div>';
  return h;
}
function teamCard(){
  const e={},dayEmp={};S.orders.forEach(o=>{if(o.st==='done'&&o.sc){const x=e[o.sc.by]||(e[o.sc.by]={o:0,p:0,days:{}});x.o++;x.p+=o.lines.length;x.days[o.sc.date]=1;const d=dayEmp[o.sc.date]||(dayEmp[o.sc.date]={});d[o.sc.by]=(d[o.sc.by]||0)+1}});
  const ks=Object.keys(e).sort((a,b)=>e[b].o-e[a].o);if(!ks.length)return '';
  const tot=ks.reduce((a,k)=>a+e[k].o,0),mx=e[ks[0]].o,dd=Object.keys(dayEmp).sort().slice(-10).reverse();
  return '<div style="margin-top:16px">'+card('الفريق',ks.map(k=>hbar(esc(k),e[k].o,mx,fmt(e[k].o)+' أوردر · '+fmt(e[k].p)+' قطعة · '+shareP(e[k].o,tot)+'%')).join('')
   +'<details class="dd" style="margin-top:12px"><summary><b>كل يوم</b><span class="muted" style="font-size:12px">آخر '+dd.length+' يوم</span></summary><div class="tw" style="border:0;border-radius:0"><table class="t-sm"><thead><tr><th>اليوم</th>'+ks.map(k=>'<th class="num">'+esc(k)+'</th>').join('')+'<th class="num">الإجمالي</th></tr></thead><tbody>'+dd.map(d=>'<tr><td class="mono">'+d+'</td>'+ks.map(k=>'<td class="num">'+(dayEmp[d][k]?N(dayEmp[d][k]):'<span class="muted">·</span>')+'</td>').join('')+'<td class="num"><b>'+N(ks.reduce((a,k)=>a+(dayEmp[d][k]||0),0))+'</b></td></tr>').join('')+'</tbody></table></div></details>','أوردرات اتشحنت حسب الموظف · كل البيانات')+'</div>';
}
function healthLine(Dd){
  return '<div class="msg '+((Dd.oos.length||Dd.blk.length)?'warn':'good')+' row sp" style="margin-bottom:16px"><span><b>صحة المخزون دلوقتي:</b> '+fmt(Dd.oos.length)+' صنف خلصان وعليه طلب · '+fmt(Dd.low)+' صنف قرب يخلص · '+fmt(Dd.blk.length)+' أوردر معطل</span><span class="row" style="gap:8px"><button class="btn sm" data-a="oos">الأصناف الخلصانة</button><button class="btn sm" data-a="instab" data-v="plan">المخزون والتصنيع</button><button class="btn sm" data-a="instab" data-v="stuck">المعطل</button></span></div>';
}
function topSkuCard(A){
  const ks=topKeys(A.sku,10);if(!ks.length)return '';
  return card('أعلى 10 أصناف طلبًا',ks.map(s=>hbar(thumb(SKU.get(s).m,22)+' '+sw(SKU.get(s).c)+' '+esc(skuName(s)),A.sku[s],A.sku[ks[0]],fmt(A.sku[s]),'',s)).join(''),'أعلى 10');
}
