  h+='<div class="stack">';
  if(isToday&&older.length)h+='<div class="msg warn row sp"><span>فيه <b>'+older.length+'</b> أوردر من أيام فاتت (من '+esc(oldDay)+') لسه ما اتشحنوش.</span><span class="row"><button class="btn sm" data-a="vdset" data-d="'+oldDay+'">اعرض يوم '+esc(oldDay)+'</button><button class="btn sm" data-a="of2" data-v="wait">افتحهم في الأوردرات</button></span></div>';
  const wait=open.filter(o=>!C.blocked[o.ref]),vv=a=>a.reduce((x,o)=>x+ordVal(o),0);
  const shipDay={};S.moves.forEach(m=>{if(m.type==='SCN'){const q=m.from==='READY'&&m.to==='EXT_CH'?m.q:m.from==='EXT_CH'&&m.to==='READY'?-m.q:0;if(q)shipDay[m.date]=(shipDay[m.date]||0)+q}});
  const l7=[];for(let i=6;i>=0;i--){const d=addDays(date,-i);l7.push([d,Math.max(0,shipDay[d]||0)])}
  const prev6=l7.slice(0,6).map(x=>x[1]),avg=prev6.reduce((a,v)=>a+v,0)/6,tdy=l7[6][1],cmp=(avg>0&&prev6.filter(v=>v>0).length>=3)?(tdy>=avg?'▲ ':'▼ ')+Math.abs(Math.round((tdy-avg)/avg*100))+'% عن متوسط آخر 6 أيام':'';
  /* ---- hero: where are we, what next ---- */
  let head,btn='';
  if(!os.length){head='مفيش بيك أب في اليوم ده';if(isToday)btn='<button class="btn pri" data-a="upload" data-t="pickup">ارفع بيك أب</button>'}
  else if(blk.length){head='<b>'+fmt(blk.length)+' أوردر</b> هيقف بالرصيد · '+EGP(vv(blk));btn='<button class="btn pri" data-a="flow" data-w="blocked">شوف الواقف</button>'}
  else if(wait.length){head='<b>'+fmt(wait.length)+' أوردر</b> مستنيين الشحن · '+EGP(vv(wait));if(isToday)btn='<button class="btn pri" data-a="upload" data-t="scan">ارفع ملف السكان</button>'}
  else head='كل اللي اتطلب اتشحن ✓';
  const pctD=os.length?Math.round(done.length/os.length*100):0,mx7=Math.max(1,...l7.map(x=>x[1]));
  const leg=(l,n,p,c,w)=>'<button type="button" class="hl" '+(n?'data-a="flow" data-w="'+w+'"':'disabled')+'><i class="dot" style="background:'+c+'"></i><span>'+l+'</span><b class="n">'+fmt(n)+'</b><span class="muted">'+fmt(p)+' قطعة</span></button>';
  h+='<section class="card hero lift"><div class="rwrap" role="img" aria-label="اتشحن '+done.length+' من '+os.length+'">'+ring([[done.length,'var(--c-ready)'],[wait.length,'var(--line2)'],[blk.length,'var(--c-scrap)']],os.length,128)+'<div class="rc"><b class="n">'+pctD+'%</b><small>اتشحن</small></div></div>'
   +'<div class="hmain"><div class="hhead">'+head+'</div><div class="muted" style="font-size:13px;margin-top:2px">'+(os.length?fmt(os.length)+' أوردر · '+fmt(pc(os))+' قطعة مطلوبة '+(isToday?'النهارده':'في اليوم ده'):'ارفع ملف البيك أب أو غيّر يوم العمل.')+'</div>'+(btn?'<div style="margin-top:12px">'+btn+'</div>':'')
   +(os.length?'<div class="hlegend">'+leg('اتشحن',done.length,pc(done),'var(--c-ready)','done')+leg('مستني الشحن',wait.length,pc(wait),'var(--line2)','wait')+leg('هيقف بالرصيد',blk.length,pc(blk),'var(--c-scrap)','blocked')+'</div>':'')+'</div>'
   +'<div class="hside"><div class="hmoney"><div><small>قيمة المطلوب</small><b class="n">'+EGP(vv(os))+'</b></div><div><small>اتشحن</small><b class="n" style="color:var(--good)">'+EGP(vv(done))+'</b></div><div><small>واقف</small><b class="n" style="color:'+(blk.length?'var(--crit)':'var(--muted)')+'">'+EGP(vv(blk))+'</b></div></div>'
   +'<div class="spk" data-tip="المشحون يوميًا (بالقطعة) آخر 7 أيام">'+l7.map((x,i)=>'<span class="b'+(i===6?' now':'')+'" data-tip="'+x[0]+': '+fmt(x[1])+' قطعة"><i style="height:'+Math.max(3,Math.round(x[1]/mx7*34))+'px"></i></span>').join('')+'</div><div class="muted" style="font-size:11.5px">اتشحن '+fmt(tdy)+' قطعة'+(cmp?' · '+cmp:'')+'</div></div></section>';
  /* ---- what needs me + what happened ---- */
  const G={};S.moves.forEach(m=>{if(m.date!==date)return;const k=m.doc+'|'+m.type,g=G[k]||(G[k]={doc:m.doc,type:m.type,t:0,by:m.by,pcs:0,sk:new Set()});g.pcs+=m.q;g.sk.add(m.sku);if(m.t>g.t)g.t=m.t});
  const ev=Object.keys(G).map(k=>{const g=G[k],dc=S.docs.find(x=>x.no===g.doc),T=OT[g.type]||{ar:g.type,grp:'',ic:'swap'};
    return {t:g.t,ic:T.ic||'swap',grp:T.grp,txt:(g.type==='SCN'&&dc&&dc.hdr&&dc.hdr.refs?fmt(dc.hdr.refs.length)+' أوردر اتشحنوا':T.ar+' · '+g.sk.size+' صنف'),by:(dc&&dc.hdr&&dc.hdr.emp)||g.by,pcs:g.pcs,rev:/\(عكس\)/.test(g.doc||'')}});
  S.orders.forEach(o=>{if(o.cx&&o.cx.date===date)ev.push({t:o.cx.at,ic:'back',grp:'',txt:'اتلغى أوردر '+o.ref,by:o.cx.by,pcs:o.lines.length,rev:false})});
  ev.sort((a,b)=>b.t-a.t);
  const GP={'دخول':'good','خروج':'info','داخلي':'warn','رقابة':'lost'};
  const acts=A.length?'<div class="queue">'+A.map((a,i)=>'<div class="q '+a.sev+'"><div class="ic">'+(a.sev==='info'?'i':'!')+'</div><div><b>'+a.t+'</b><span>'+a.d+'</span></div><button class="btn sm" data-a="act" data-i="'+i+'">'+a.b+'</button></div>').join('')+'</div>':'<div class="msg good">كل حاجة تمام. مفيش حاجة محتاجة تدخّل دلوقتي.</div>';
  const tl=ev.length?'<div class="tl">'+ev.slice(0,7).map(e=>'<div class="tli"><span class="tb '+(GP[e.grp]||'')+'">'+ic(e.ic)+'</span><span class="tt"><b>'+e.txt+(e.rev?' <span class="pill crit">عكس</span>':'')+'</b><small class="muted">'+esc(e.by||'')+(e.t>1e12?' · '+timeOf(e.t):'')+'</small></span><b class="n tq">'+fmt(e.pcs)+'</b></div>').join('')+'</div>'+(ev.length>7?'<button class="btn sm ghost" data-a="go" data-t="ledger" style="margin-top:8px">كل الحركات ('+ev.length+')</button>':''):'<div class="empty">'+(isToday?'لسه مفيش حركات النهارده.':'مفيش حركات في اليوم ده.')+'</div>';
  h+='<div class="grid tsplit"><section class="card"><h2>محتاج تدخّل <span class="hint">'+(A.length?A.length+' حاجة':'')+'</span></h2>'+acts+'</section><section class="card"><h2>حصل إيه '+(isToday?'النهارده':'في اليوم ده')+' <span class="hint">'+(ev.length?ev.length+' عملية':'')+'</span></h2>'+tl+'</section></div>';
  /* ---- pickups, stock by state, team ---- */
  const pkT=pks.length?'<div class="tw" style="border:0"><table class="dt"><thead><tr><th>البيك أب</th><th>التقدم</th><th class="num">قطع</th><th class="num">القيمة</th></tr></thead><tbody>'+pks.map(p=>{const po=S.orders.filter(o=>o.pk===p.id&&o.st!=='cx'),pd=po.filter(o=>o.st==='done').length;
    return '<tr data-a="gopk" data-id="'+p.id+'" style="cursor:pointer"><td><b>'+esc(p.label)+'</b><br><span class="muted" style="font-size:12px">'+esc(chanName(p.channel))+'</span></td><td><span class="cvr">'+bar(pd,po.length,'g')+'<span class="n">'+pd+' / '+po.length+'</span></span></td><td class="num">'+N(po.reduce((x,o)=>x+o.lines.length,0))+'</td><td class="num">'+EGP(vv(po))+'</td></tr>'}).join('')+'</tbody></table></div>':'<div class="empty">مفيش بيك أب.</div>';
  const names=Object.keys(emp).sort((a,b)=>emp[b].o-emp[a].o),mxe=names.length?emp[names[0]].o:1;
  const tm=names.length?names.map(k=>'<div class="emp"><span class="row sp"><b>'+esc(k)+'</b><span class="muted" style="font-size:12px">'+timeOf(emp[k].a)+' ← '+timeOf(emp[k].b)+'</span></span><span class="cvr">'+bar(emp[k].o,mxe,'')+'<span class="n">'+fmt(emp[k].o)+'</span> <span class="muted" style="font-size:12px">أوردر · '+fmt(emp[k].p)+' قطعة</span></span></div>').join('')+'<p class="muted" style="margin:8px 0 0;font-size:12px">الوقت هو وقت تسجيل الملف، مش وقت التغليف.</p>':'<div class="empty">لسه محدش سجّل سكان '+(isToday?'النهارده':'في اليوم ده')+'.</div>';
  h+='<section class="card"><h2>البيك أب <span class="hint">'+pks.length+'</span></h2>'+pkT+'</section>';
  h+='<div class="grid g2 t3"><section class="card"><h2>المخزون حسب الحالة</h2>'+stateBar()+'</section><section class="card"><h2>'+(isToday?'الفريق النهارده':'الفريق')+'</h2>'+tm+'</section></div>';
  h+='</div>';
  return h;
