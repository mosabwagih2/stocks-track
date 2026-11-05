/* ---------- v2: the log, redesigned around two questions ----------
   "اللي حصل": one feed of everything that happened (who, when, what), grouped by day, open an item to see its lines.
   "تتبّع صنف": the full journey of one item (every move and its balance after). */
const LG_GROUPS=[['all','الكل'],['in','دخول'],['out','خروج'],['int','داخلي'],['ctl','جرد ومفقود'],['cx','إلغاء أوردر'],['sup','مستلزمات'],['sys','النظام']];
const LG_DOCGRP={RCV:'in',RTN:'in',SCN:'out',SHP:'out',CLN:'int',FSD:'int',FRC:'int',CNT:'ctl',LOS:'ctl',OPN:'sys'};
const LG_ICON={in:'in',out:'out',int:'swap',ctl:'count',cx:'back',sup:'files',sys:'config'};
const LG_TONE={in:'good',out:'info',int:'warn',ctl:'lost',cx:'crit',sup:'',sys:''};
const cairoDay=t=>new Date(t).toLocaleDateString('en-CA',{timeZone:'Africa/Cairo'});
function lgDescribe(g,doc){
  const sum=f=>g.mv.filter(f).reduce((a,m)=>a+m.q,0),n=g.pcs,H=doc?doc.hdr||{}:{};
  switch(g.type){
    case 'SCN':return 'شحن '+(H.refs?H.refs.length+' أوردر':'أوردرات')+' · '+fmt(n)+' قطعة';
    case 'RCV':return 'استلام من المصنع · '+fmt(n)+' قطعة'+(H.ref?' (إذن '+esc(H.ref)+')':'');
    case 'RTN':{const r=sum(m=>m.to==='READY'),d=sum(m=>m.to==='DIRTY'),x=sum(m=>m.to==='SCRAP'),l=sum(m=>m.to==='LOST');return 'استلام مرتجعات'+(H.channel?' من '+esc(chanName(H.channel)):'')+': سليم '+fmt(r)+(d?' · نضافة '+fmt(d):'')+(x?' · هالك '+fmt(x):'')+(l?' · ناقص '+fmt(l):'')}
    case 'SHP':return 'توريد للمحل'+((H.shop||H.note)?' ('+esc(H.shop||H.note)+')':'')+' · '+fmt(n)+' قطعة';
    case 'CLN':return 'تصنيف حالة: '+esc(LOC[H.from]||'')+' ← '+esc(LOC[H.to]||'')+' · '+fmt(n)+' قطعة';
    case 'FSD':return (H.kind==='wash'?'إرسال للمصنع للغسيل':'تسليم هالك للمصنع')+' · '+fmt(n)+' قطعة';
    case 'FRC':{const x=sum(m=>m.to==='SCRAP');return 'استلام من المصنع: رجع '+fmt(sum(m=>m.to==='READY'))+(x?' · مرفوض '+fmt(x):'')}
    case 'CNT':{const p=sum(m=>m.from==='EXT_ADJ'),mi=sum(m=>m.to==='EXT_ADJ');return 'جرد: '+(p||mi?(mi?'عجز '+fmt(mi):'')+(p&&mi?' · ':'')+(p?'زيادة '+fmt(p):''):'مفيش فروق')}
    case 'LOS':return 'معالجة مفقود: لقينا '+fmt(sum(m=>m.to==='READY'))+' · شطبنا '+fmt(sum(m=>m.to==='EXT_OFF'));
    case 'OPN':return 'رصيد افتتاحي · '+fmt(n)+' قطعة';
    default:return esc((OT[g.type]||{ar:g.type}).ar)+' · '+fmt(n)+' قطعة';
  }
}
function ledgerEvents(){
  const ev=[],G={};
  S.moves.forEach(m=>{if(m.type==='CXL')return;const key=m.date+'|'+m.doc+'|'+m.type,g=G[key]||(G[key]={key,date:m.date,doc:m.doc,type:m.type,t:0,by:m.by,mv:[],pcs:0});g.mv.push(m);g.pcs+=m.q;if(m.t>g.t)g.t=m.t});
  Object.keys(G).forEach(k=>{const g=G[k],isRev=/\(عكس\)/.test(g.doc||''),base=String(g.doc||'').replace(' (عكس)',''),doc=S.docs.find(x=>x.no===base),T=OT[g.type]||{ar:g.type,grp:''};
    const who=(g.type==='SCN'&&doc&&doc.hdr&&doc.hdr.emp)?doc.hdr.emp:(g.type==='OPN'?'النظام':(g.by||''));
    ev.push({key:'d'+k,kind:'doc',grp:LG_DOCGRP[g.type]||'int',t:g.t,date:g.date,who,type:T.ar,title:isRev?'تراجع عن '+esc(base)+' (اتلغى تأثيرها على الرصيد)':lgDescribe(g,doc),no:g.doc,pcs:g.pcs,rev:isRev,revd:!!(doc&&doc.status==='reversed'),g,doc,actor:g.by})});
  S.orders.forEach(o=>{if(o.cx&&o.cx.at)ev.push({key:'x'+o.ref,kind:'cx',grp:'cx',t:o.cx.at,date:o.cx.date||cairoDay(o.cx.at),who:o.cx.by,type:'إلغاء أوردر',title:'إلغاء أوردر '+esc(o.ref)+(o.cx.reason?': '+esc(o.cx.reason):''),no:'',pcs:o.lines.length,o,returned:o.cx.returned})});
  S.sup.log.forEach(e=>{if(['rcv','count','issue'].indexOf(e.kind)<0)return;const it=supItem(e.item);ev.push({key:'s'+e.id,kind:'sup',grp:'sup',t:e.t,date:e.date||cairoDay(e.t),who:e.by||'',type:'مستلزمات',title:(e.kind==='rcv'?'استلام ':e.kind==='issue'?'صرف ':'جرد ')+esc(it?it.name:e.item)+': '+(e.q>0?'+':'')+fmt(e.q)+(e.why?' · '+esc(e.why):''),no:'',pcs:Math.abs(e.q),e})});
  (S.audit||[]).forEach((a,i)=>ev.push({key:'a'+i,kind:'sys',grp:'sys',t:a.t,date:cairoDay(a.t),who:a.by,type:'النظام',title:esc(a.m),no:'',pcs:0}));
  return ev;
}
function ledgerFiltered(){
  const L=UI.led;L.open=L.open||{};
  const q=arN((L.q||'').trim()).split(/\s+/).filter(Boolean),gsel=L.type&&LG_DOCGRP[L.type]?LG_DOCGRP[L.type]:(LG_GROUPS.some(x=>x[0]===L.type)?L.type:'all');
  let ev=ledgerEvents();
  const people=[...new Set(ev.map(e=>e.who).filter(Boolean))].sort();
  if(gsel!=='all')ev=ev.filter(e=>e.grp===gsel);
  if(L.who)ev=ev.filter(e=>e.who===L.who);
  if(L.day)ev=ev.filter(e=>e.date===L.day);
  if(q.length)ev=ev.filter(e=>{let hay=arN(e.title+' '+e.who+' '+(e.no||'')+' '+(e.o?e.o.ref+' '+e.o.wb:''));if(e.g){const seen={};e.g.mv.forEach(m=>{if(seen[m.sku])return;seen[m.sku]=1;const k=SKU.get(m.sku);if(k)hay+=' '+arN(k.m+' '+k.c+' '+k.s+' '+MODEL.get(k.m).name)})}return q.every(w=>SZ_SET[w]?new RegExp('(^| )'+w+'( |$)').test(hay):hay.indexOf(w)>=0)});
  ev.sort((a,b)=>(a.date<b.date?1:a.date>b.date?-1:0)||(b.t||0)-(a.t||0));
  const byD={};ev.forEach(e=>{(byD[e.date]||(byD[e.date]=[])).push(e)});
  return {people,gsel,byD,days:Object.keys(byD).sort().reverse(),L};
}
function ledgerFeed(){
  const F=ledgerFiltered(),L=F.L,people=F.people,gsel=F.gsel;
  let h='<div class="lgbar"><div class="chips scrollx" role="group" aria-label="نوع العملية">'+LG_GROUPS.map(x=>'<button class="chip" aria-pressed="'+(gsel===x[0])+'" data-a="lgrp" data-v="'+x[0]+'">'+x[1]+'</button>').join('')+'</div>'
   +'<div class="row" style="gap:8px;flex-wrap:wrap"><select data-c="lwho" aria-label="الشخص"><option value="">كل الناس</option>'+people.map(p=>'<option value="'+esc(p)+'" '+(L.who===p?'selected':'')+'>'+esc(p)+'</option>').join('')+'</select><input type="date" data-c="ldate" value="'+esc(L.day||'')+'" aria-label="اليوم">'+((L.day||L.who||gsel!=='all'||L.q)?'<button class="btn sm ghost" data-a="lclear">مسح الفلاتر</button>':'')+'</div></div>';
  h+='<div class="srch" style="max-width:none"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg><input type="search" id="lq" data-c="lq" placeholder="دوّر: رقم مستند، أوردر، صنف، أو اسم" value="'+esc(L.q||'')+'" aria-label="بحث في السجل"></div>';
  h+='<div id="ledres">'+ledgerList(F.days,F.byD,L)+'</div>';
  return h;
}
function ledgerList(days,byD,L){
  if(!days.length)return '<div class="card"><div class="empty">مفيش حاجة بالفلاتر دي.</div></div>';
  const nd=L.nd||7,shown=days.slice(0,nd);
  let h='';
  shown.forEach(d=>{
    const es=byD[d],inn=es.filter(e=>e.kind==='doc'&&!e.rev&&e.grp==='in').reduce((a,e)=>a+e.pcs,0),out=es.filter(e=>e.kind==='doc'&&!e.rev&&e.type==='شحن أوردرات'||e.kind==='doc'&&!e.rev&&e.g&&e.g.type==='SCN').reduce((a,e)=>a+e.pcs,0);
    h+='<section class="card lgday"><h2>'+esc(dayName(d))+' <span class="hint">'+es.length+' حدث'+(out?' · شحن '+fmt(out)+' قطعة':'')+(inn?' · دخل '+fmt(inn)+' قطعة':'')+'</span></h2><div class="lgl">';
    es.forEach(e=>{
      const op=!!L.open[e.key],can_=e.kind!=='sys';
      h+='<div class="lge'+(op?' open':'')+'"><div class="lgr"'+(can_?' data-a="ldoc" data-k="'+esc(e.key)+'" role="button" aria-expanded="'+op+'" tabindex="0"':'')+'>'
       +'<span class="tb '+(LG_TONE[e.grp]||'')+'">'+ic(LG_ICON[e.grp]||'files')+'</span>'
       +'<span class="lgt"><b>'+e.title+(e.rev?' <span class="pill">تراجع</span>':e.revd?' <span class="pill">اتلغت</span>':'')+'</b><small class="muted">'+(e.who?esc(e.who):'—')+(e.t>1e12?' · '+timeOf(e.t):'')+(e.no?' · <span class="mono">'+esc(e.no)+'</span>':'')+'</small></span>'
       +'<span class="lgp">'+(e.pcs&&e.kind!=='sup'?'<b class="n">'+fmt(e.pcs)+'</b><small class="muted">قطعة</small>':'')+'</span>'+(can_?'<span class="chev" aria-hidden="true">‹</span>':'<span></span>')+'</div>';
      if(op)h+='<div class="lgd">'+ledgerDetail(e)+'</div>';
      h+='</div>';
    });
    h+='</div></section>';
  });
  if(days.length>nd)h+='<div style="text-align:center;margin-top:12px"><button class="btn" data-a="ldmore">عرض أيام أقدم ('+(days.length-nd)+')</button></div>';
  return h;
}
function ledgerDetail(e){
  if(e.kind==='doc'){
    const g=e.g,pairs={};g.mv.forEach(m=>{const k=m.from+'>'+m.to;pairs[k]=(pairs[k]||0)+m.q});const pk=Object.keys(pairs).sort((a,b)=>pairs[b]-pairs[a]);
    const byM={};g.mv.forEach(m=>{const k=SKU.get(m.sku),mk=k?k.m:'؟';(byM[mk]||(byM[mk]=[])).push(m)});
    const loc=k=>LOC[k]||k;
    return (e.actor&&e.actor!==e.who?'<div class="lgmeta muted">اتسجّلت بواسطة '+esc(e.actor)+'</div>':'')
     +Object.keys(byM).sort((a,b)=>mkey(a)<mkey(b)?-1:1).map(mk=>'<div class="lgm"><span class="lgn"><b class="mono">'+esc(mk)+'</b> <span class="muted">'+esc(MODEL.get(mk)?MODEL.get(mk).name:'')+'</span> <span class="n muted">'+fmt(byM[mk].reduce((a,m)=>a+m.q,0))+'</span></span><span>'+lgMini(mk,byM[mk],pk[0],loc)+'</span></div>').join('')
     +(e.doc?'<div style="margin-top:8px"><button class="btn sm" data-a="opendoc2" data-id="'+e.doc.id+'">افتح المستند</button></div>':'');
  }
  if(e.kind==='cx')return '<div class="lgmeta">'+(e.o.cx.reason?'السبب: '+esc(e.o.cx.reason)+'. ':'')+(e.returned?'القطع رجعت للمخزون.':'')+'</div><div style="margin-top:8px"><button class="btn sm" data-a="order" data-ref="'+esc(e.o.ref)+'">افتح الأوردر</button></div>';
  if(e.kind==='sup')return '<div class="lgmeta">'+esc(e.e.why||'')+'</div>';
  return '';
}
/* ---------- one item's journey ---------- */
function ledgerSku(){
  const L=UI.led,q=arN((L.sq||'').trim()).split(/\s+/).filter(Boolean);
  let h='<div class="srch" style="max-width:none"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg><input type="search" id="lsq" data-c="lsq" placeholder="اكتب كود الصنف: BR2 احمر L" value="'+esc(L.sq||'')+'" aria-label="دوّر على صنف"></div><div id="ledres">'+ledgerSkuBody(q)+'</div>';
  return h;
}
function ledgerSkuBody(q){
  const L=UI.led;
  if(L.sku&&SKU.get(L.sku))return skuJourney(L.sku);
  if(!q.length){
    const cnt={};S.moves.slice(-1500).forEach(m=>{cnt[m.sku]=(cnt[m.sku]||0)+1});const top=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]).slice(0,10);
    return '<div class="card"><div class="empty" style="padding:20px 10px">اكتب كود الصنف فوق وشوف رحلته: دخل منين، اتحرك فين، ورصيده بقى كام بعد كل حركة.</div>'+(top.length?'<div class="gh" style="margin:10px 0 8px">أكتر الأصناف حركة</div><div class="chips">'+top.map(s=>'<button class="chip" data-a="lsk" data-id="'+s+'">'+sw(SKU.get(s).c)+' '+esc(skuName(s))+'</button>').join('')+'</div>':'')+'</div>';
  }
  const hits=D.skus.filter(k=>{const hay=arN(k.id+' '+k.m+' '+k.c+' '+k.s+' '+MODEL.get(k.m).name);return q.every(w=>SZ_SET[w]?k.s.toLowerCase()===w:hay.indexOf(w)>=0)});
  if(!hits.length)return '<div class="card"><div class="empty">مفيش صنف بالاسم ده.</div></div>';
  if(hits.length===1)return skuJourney(hits[0].id);
  return '<div class="card"><h2 style="font-size:15px">اختار الصنف <span class="hint">'+hits.length+' نتيجة'+(hits.length>40?' (أول 40)':'')+'</span></h2><div class="tw"><table class="t-sm"><thead><tr><th>الصنف</th><th class="num">جاهز</th><th class="num">حركات</th></tr></thead><tbody>'+hits.slice(0,40).map(k=>'<tr data-a="lsk" data-id="'+k.id+'" style="cursor:pointer"><td>'+sw(k.c)+' '+esc(skuName(k.id))+'</td><td class="num"><b class="n">'+fmt(g(k.id,'READY'))+'</b></td><td class="num muted">'+S.moves.reduce((a,m)=>a+(m.sku===k.id?1:0),0)+'</td></tr>').join('')+'</tbody></table></div></div>';
}
function skuJourney(id){
  const L=UI.led,k=SKU.get(id),mv=S.moves.filter(m=>m.sku===id);let run=0;const rows=mv.map(m=>{const d=(m.to==='READY'?m.q:0)-(m.from==='READY'?m.q:0);run+=d;return {m,d,run}}).reverse();
  const nn=L.sn||40,shown=rows.slice(0,nn);
  const st=INTERNAL.map(l=>'<span class="pill '+({READY:'good',DIRTY:'warn',FACTORY:'info',SCRAP:'crit',LOST:'lost'}[l]||'')+'">'+LOC[l]+' <b class="n">'+fmt(g(id,l))+'</b></span>').join('');
  let h='<div class="card" style="margin-bottom:12px"><div class="row sp" style="gap:12px"><span class="row" style="gap:10px;flex-wrap:nowrap">'+thumb(k.m,40)+'<span><b style="font-size:16px">'+esc(skuName(id))+'</b><div class="muted" style="font-size:12.5px">'+esc(MODEL.get(k.m).name)+' · '+fmt(mv.length)+' حركة</div></span></span><button class="btn sm ghost" data-a="lskx">صنف تاني</button></div><div class="chips" style="margin-top:10px">'+st+'</div></div>';
  h+='<div class="tw"><table class="dt"><thead><tr><th>اليوم</th><th>العملية</th><th class="num">الكمية</th><th class="num">الجاهز بعدها</th><th>الشخص</th></tr></thead><tbody>'+shown.map(r=>{const m=r.m,T=OT[m.type]||{ar:m.type},isRev=/\(عكس\)/.test(m.doc||'');return '<tr><td class="mono">'+esc(m.date)+(m.t>1e12?'<div class="muted" style="font-size:11px">'+timeOf(m.t)+'</div>':'')+'</td><td><span class="pill">'+esc(T.ar)+'</span>'+(isRev?' <span class="pill">تراجع</span>':'')+' <span class="mono muted" style="font-size:12px">'+esc(m.doc||'')+'</span></td><td class="num"><b class="n">'+m.q+'</b></td><td class="num">'+(r.d?'<span class="n" style="color:'+(r.d>0?'var(--good)':'var(--crit)')+'">'+(r.d>0?'+':'−')+Math.abs(r.d)+'</span> → ':'')+'<b class="n">'+fmt(r.run)+'</b></td><td>'+esc(m.by||'')+'</td></tr>'}).join('')+'</tbody></table></div>';
  if(rows.length>nn)h+='<div style="text-align:center;margin-top:12px"><button class="btn" data-a="lsmore">عرض حركات أقدم ('+(rows.length-nn)+')</button></div>';
  return h;
}
function vLedger(){
  const L=UI.led,tab=L.tab==='sku'||L.tab==='moves'?'sku':L.tab==='arch'?'arch':'feed';L.tab=tab;
  let h=top('السجل','','')
   +'<div class="seg lgseg" role="tablist" style="margin-bottom:6px"><button role="tab" aria-selected="'+(tab==='feed')+'" aria-pressed="'+(tab==='feed')+'" data-a="ltab" data-v="feed">اللي حصل</button><button role="tab" aria-selected="'+(tab==='sku')+'" aria-pressed="'+(tab==='sku')+'" data-a="ltab" data-v="sku">تتبّع صنف</button><button role="tab" aria-selected="'+(tab==='arch')+'" aria-pressed="'+(tab==='arch')+'" data-a="ltab" data-v="arch">المؤرشف'+(arItems().length?' ('+arItems().length+')':'')+'</button></div>'
   +'<p class="muted" style="margin:0 2px 14px;font-size:13px">'+(tab==='feed'?'كل عملية اتعملت في السيستم، مين عملها ومتى. اضغط على أي واحدة تشوف أصنافها.':tab==='arch'?'':'رحلة صنف واحد: كل حركة دخلت أو خرجت منه ورصيده بعدها.')+'</p>';
  return h+(tab==='feed'?ledgerFeed():tab==='arch'?arPage():ledgerSku());
}
function ledRows(){
  if(UI.led.tab==='sku')return ledgerSkuBody(arN((UI.led.sq||'').trim()).split(/\s+/).filter(Boolean));
  const F=ledgerFiltered();return ledgerList(F.days,F.byD,F.L);
}
const ACT_LG={
  lgrp:el=>{const L=UI.led;L.type=el.dataset.v==='all'?'':el.dataset.v;L.nd=7;render()},
  lclear:()=>{const L=UI.led;L.type='';L.who='';L.day='';L.q='';L.nd=7;render()},
  lsk:el=>{UI.led.sku=el.dataset.id;UI.led.sn=40;render()},
  lskx:()=>{UI.led.sku=null;render()},
  lsmore:()=>{UI.led.sn=(UI.led.sn||40)+40;render()}
};
const CHG_LG={
  lwho:el=>{UI.led.who=el.value;UI.led.nd=7;render()},
  ldate:el=>{UI.led.day=el.value;UI.led.nd=7;render()}
};
const INP_LG={
  lsq:el=>{UI.led.sq=el.value;UI.led.sku=null;const r=$('#ledres');if(r)r.innerHTML=ledRows();_L.main=null}
};
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target&&e.target.classList&&e.target.classList.contains('lgr')){e.preventDefault();e.target.click()}});
