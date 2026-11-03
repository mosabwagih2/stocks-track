/* ---------- v2: analytics questions in one place each ---------- */
function insNoteList(A,C){const notes=insNotes(A,C);return '<div>'+notes.map(x=>'<div class="insn"><span class="ic '+x.k+'">'+(x.k==='crit'||x.k==='warn'?'!':x.k==='good'?'✓':'i')+'</span><span>'+x.t+'</span></div>').join('')+'</div>'}
function insDemand2(A,C){
  if(!A.o)return noData();
  const nM=Object.keys(A.m).length,nS=Object.keys(A.sku).length,mxs=Math.max(1,...Object.values(A.s));
  let h=strip([si('أوردرات مطلوبة',N(A.o),fmt(A.p)+' قطعة'),si('متوسط القطع في الأوردر',(A.p/A.o).toFixed(1),A.bk['1']+' أوردر قطعة واحدة'),si('موديلات بتتسحب',N(nM),'من '+MORDER.length),si('أصناف بتتسحب',N(nS),'من '+D.skus.length+' صنف'),si('اتشحن',N(A.done),shareP(A.done,A.o)+'% من المطلوب','good')]);
  h+='<div class="grid split">'+card('أهم الملاحظات',insNoteList(A,C))+card('الطلب اليومي',trendChart(A))+'</div>';
  h+='<div style="margin-top:16px">'+card('خريطة الطلب: الموديل × المقاس','<p class="muted" style="margin-bottom:10px;font-size:13px">كل خانة هي عدد القطع المطلوبة. اللون الأغمق يعني طلب أكتر.</p>'+heatmap(A),'أعلى 14 موديل')+'</div>';
  h+='<div class="grid g2" style="margin-top:16px">'+card('حصة الموديلات من الطلب',modelBars(A,8),'أعلى 8 موديلات')+card('الألوان',topKeys(A.c,10).map(c=>hbar(sw(c)+' '+esc(c),A.c[c],A.c[topKeys(A.c,1)[0]],fmt(A.c[c])+' · '+shareP(A.c[c],A.p)+'%')).join(''),'أعلى 10')+'</div>';
  h+='<div class="grid g2" style="margin-top:16px">'+card('المقاسات',Object.keys(A.s).sort((a,b)=>szi(a)-szi(b)).map(z=>hbar(z,A.s[z],mxs,fmt(A.s[z])+' · '+shareP(A.s[z],A.p)+'%')).join(''))+card('المحافظات',Object.keys(A.g).length?topKeys(A.g,10).map(g_=>hbar(esc(g_),A.g[g_],A.g[topKeys(A.g,1)[0]],fmt(A.g[g_])+' أوردر')).join(''):'<div class="empty">مفيش بيانات محافظات.</div>','أعلى 10')+'</div>';
  const bk=A.bk,mxb=Math.max(...Object.values(bk),1);
  h+='<div class="grid g2" style="margin-top:16px">'+card('حجم الأوردر','<p class="muted" style="margin-bottom:8px;font-size:13px">كام قطعة في الأوردر الواحد</p>'+['1','2','3-4','5+'].map(k=>hbar(k==='1'?'قطعة واحدة':k==='2'?'قطعتين':k+' قطع',bk[k],mxb,fmt(bk[k])+' · '+shareP(bk[k],A.o)+'%')).join('')+'<div style="margin-top:12px">'+Object.keys(A.ty).map(k=>hbar(esc(k),A.ty[k],A.o,fmt(A.ty[k])+' · '+shareP(A.ty[k],A.o)+'%',k==='استبدال'?'w':'g')).join('')+'</div>')+insKits(C)+'</div>';
  return h;
}
function insPlan2(A,C){
  const R=rateData(),PR=planRows(),L=UI.insL||'all',byM={};PR.forEach(r=>{(byM[SKU.get(r.id).m]||(byM[SKU.get(r.id).m]=[])).push(r)});
  UI.insX=UI.insX||{};
  const rows=R.rows.filter(r=>(r.rate>0||r.need>0||r.ready>0)&&(L==='all'||lineOf(r.m)===L)).sort((a,b)=>prioK(a.k)-prioK(b.k)||b.need-a.need||b.rate-a.rate);
  const nCrit=R.rows.filter(r=>r.k==='crit').length,nWarn=R.rows.filter(r=>r.k==='warn').length,need=R.rows.reduce((a,r)=>a+r.need,0),cover=R.tot>0?R.totReady/R.tot:null;
  const fw=n=>n==null?'—':(n>=99?'99+':n.toFixed(1)),pc=v=>v==null?'—':Math.round(v*100)+'%';
  const arrow=t=>t==null?'<span class="muted">—</span>':(t>=0?'<span style="color:var(--good)">▲ ':'<span style="color:var(--crit)">▼ ')+(Math.abs(t)>3?'>300':Math.abs(Math.round(t*100)))+'%</span>';
  let h=strip([si('اطلب تصنيع دلوقتي',N(nCrit),nWarn?nWarn+' كمان قربوا':'موديل',nCrit?'crit':nWarn?'warn':'good'),si('مقترح تصنيعه',N(need),'قطعة · لهدف '+R.tgt+' أسابيع',need?'warn':''),si('تغطية المخزون',fw(cover),'أسبوع بمعدل السحب'),si('معدل السحب',N(Math.round(R.tot)),'قطعة / أسبوع'),si('مهلة المصنع',N(R.lead),'أسبوع · مستوى الخدمة '+R.svc+'%','','go:config')]);
  if(R.span<14)h+='<div class="msg warn" style="margin-bottom:14px">عندنا <b>'+R.span+' يوم</b> بيانات بس. المعدل الأسبوعي تقدير ومخزون الأمان ببديل بسيط. الاتجاه وثبات الطلب بيظهروا بعد 14 يوم.</div>';
  h+='<div class="row sp" style="margin-bottom:12px"><div class="chips scrollx">'+[['all','الكل']].concat(LINE_ORDER.map(l=>[l,l])).map(f=>'<button class="chip" aria-pressed="'+(L===f[0])+'" data-a="insline" data-v="'+f[0]+'">'+f[1]+'</button>').join('')+'</div><button class="btn pri" data-a="copyplan">نسخ للمصنع</button></div>';
  if(!rows.length)return h+'<div class="card"><div class="empty">مفيش موديلات'+(L!=='all'?' في '+L:'')+'.</div></div>';
  const mk=((R.lead+(R.rows.length?R.rows.reduce((a,r)=>a+(r.rate>0?r.ss/r.rate:0),0)/Math.max(1,R.rows.filter(r=>r.rate>0).length):R.safe))/12*100).toFixed(1);
  h+='<div class="tw"><table class="dt plt"><thead><tr><th>الموديل</th><th class="num">جاهز</th><th class="num">عند المصنع</th><th class="num">سحب/أسبوع</th><th class="num">الاتجاه</th><th>التغطية (أسبوع)</th><th class="num">نقطة الطلب</th><th class="num">يتصنّع</th><th>الحالة</th><th style="width:28px"></th></tr></thead><tbody>';
  rows.forEach(r=>{const op=!!UI.insX[r.m],sk=(byM[r.m]||[]).slice().sort((a,b)=>(a.i.cls==='c'?0:1)-(b.i.cls==='c'?0:1)||skuSort(a.id,b.id));
    h+='<tr class="mrow'+(op?' open':'')+'" data-a="plx" data-m="'+r.m+'" role="button" aria-expanded="'+op+'"><td><span class="row" style="flex-wrap:nowrap;gap:10px">'+thumb(r.m,30)+'<span><b class="mono">'+r.m+'</b> <span class="muted">'+esc(MODEL.get(r.m).name)+'</span></span></span></td><td class="num">'+N(r.ready)+'</td><td class="num">'+(r.fac?N(r.fac):'<span class="muted">0</span>')+'</td><td class="num">'+(r.rate>0?N(Math.round(r.rate)):'<span class="muted">—</span>')+'</td><td class="num">'+arrow(r.trend)+'</td>'
     +'<td>'+(r.cover==null?'<span class="muted">—</span>':'<span class="cvr"><span class="rb m" style="--x:'+mk+'%">'+'<i class="'+(r.k==='crit'?'c':r.k==='warn'?'w':'g')+'" style="width:'+Math.max(2,Math.min(100,r.cover/12*100)).toFixed(1)+'%"></i><b></b></span><span class="n">'+fw(r.cover)+'</span></span>')+'</td><td class="num">'+(r.rate>0?N(Math.round(r.rop)):'—')+'</td><td class="num">'+(r.need?'<span class="pill warn">'+fmt(r.need)+'</span>':'<span class="muted">0</span>')+'</td><td>'+(r.label==='—'?'':sd(r.k)+'<span class="sdt">'+esc(r.label)+'</span>')+'</td><td class="chev" aria-hidden="true">‹</td></tr>';
    if(op)h+='<tr class="mopen"><td colspan="10">'+(sk.length?'<table class="skt"><thead><tr><th>الصنف</th><th class="num">جاهز</th><th class="num">طلب مفتوح</th><th class="num">راجع من المصنع</th><th class="num">يتصنّع</th><th></th></tr></thead><tbody>'+sk.map(x=>'<tr data-a="sku" data-sku="'+x.id+'"><td>'+sw(SKU.get(x.id).c)+' '+esc(SKU.get(x.id).c)+' · '+esc(SKU.get(x.id).s)+'</td><td class="num">'+N(x.i.R)+'</td><td class="num">'+N(x.i.dm)+'</td><td class="num">'+N(x.pend)+'</td><td class="num"><b class="n">'+fmt(x.q)+'</b></td><td>'+(x.i.cls==='c'?pill('crit','حرج'):pill('warn','قرب'))+'</td></tr>').join('')+'</tbody></table>':'<div class="muted" style="padding:6px 2px">مفيش أصناف محتاجة تصنيع في الموديل ده دلوقتي.</div>')+'</td></tr>';
  });
  h+='</tbody></table></div><p class="muted" style="margin:8px 0 0;font-size:12px">الخط الأسود = مهلة المصنع + متوسط الأمان. المقترح = اللي يوصّل كل صنف لـ '+R.tgt+' أسبوع سحب بعد المهلة والأمان وخصم الطلب المفتوح، وده اقتراح مش أمر تصنيع.</p>';
  const RH=insRate(),pick=t=>{const m=RH.match(new RegExp('<section class="card[^"]*">\\s*<h2>'+t+'[\\s\\S]*?<\\/section>'));return m?m[0]:''};
  const wk=pick('السحب الأسبوعي'),cv=pick('التغطية بالأسابيع'),sth=pick('Sell-through'),fm=(RH.match(/<details class="dd"[\s\S]*?<\/details>/)||[''])[0];
  if(wk)h+='<div style="margin-top:16px">'+wk+'</div>';
  if(cv||sth)h+='<div class="grid g2" style="margin-top:16px">'+cv+sth+'</div>';
  if(fm)h+='<div style="margin-top:16px">'+fm+'</div>';
  return h;
}
