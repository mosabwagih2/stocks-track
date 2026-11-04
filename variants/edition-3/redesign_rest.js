/* ---------- v2: orders grouped by pickup, with value ---------- */
function ordStrip(){
  const C=ctx(),all=S.orders.filter(o=>o.st!=='cx'),wait=all.filter(o=>o.st==='open'&&!C.blocked[o.ref]),bl=all.filter(o=>o.st==='open'&&C.blocked[o.ref]),done=all.filter(o=>o.st==='done');
  const v=a=>a.reduce((x,o)=>x+ordVal(o),0);
  return strip([si('المطلوب',N(all.length),EGP(v(all))),si('مستني الشحن',N(wait.length),EGP(v(wait)),wait.length?'warn':''),si('هيقف بالمخزون',N(bl.length),EGP(v(bl)),bl.length?'crit':'good'),si('اتشحن',N(done.length),EGP(v(done)),'good')]);
}
function ordRows(list){
  const C=ctx(),pkIdx={};S.pickups.forEach((p,i)=>pkIdx[p.id]=i);
  const pr=o=>o.st==='open'?(C.blocked[o.ref]?0:1):o.st==='done'?2:3;
  const L=list.slice().sort((a,b)=>((pkIdx[b.pk]||0)-(pkIdx[a.pk]||0))||pr(a)-pr(b)).slice(0,UI.o.n);
  let last=null,h='';
  L.forEach(o=>{
    if(o.pk!==last){last=o.pk;const p=S.pickups.find(x=>x.id===o.pk);
      if(p){const po=S.orders.filter(x=>x.pk===p.id&&x.st!=='cx'),pd=po.filter(x=>x.st==='done').length,pcs=po.reduce((a,x)=>a+x.lines.length,0),val=po.reduce((a,x)=>a+ordVal(x),0),bl=po.filter(x=>x.st==='open'&&C.blocked[x.ref]).length;
        h+='<tr class="grp"><td colspan="6"><span class="row sp"><span><b>'+esc(p.label)+'</b> <span class="muted">· '+esc(chanName(p.channel))+' · '+esc(p.date)+'</span></span><span class="row" style="gap:12px">'+(bl?'<span class="pill crit">'+bl+' هيقف</span>':'')+'<span class="muted">'+fmt(pcs)+' قطعة · '+EGP(val)+'</span><span class="cvr">'+bar(pd,po.length,'g')+'<span class="n">'+pd+' / '+po.length+'</span></span></span></span></td></tr>'}}
    const val=ordVal(o);
    h+='<tr data-a="order" data-ref="'+esc(o.ref)+'"><td data-nodrill><input type="checkbox" data-c="sel" data-ref="'+esc(o.ref)+'" '+(UI.sel[o.ref]?'checked':'')+(o.st!=='open'?' disabled':'')+' aria-label="تحديد"></td><td><span class="mono">'+esc(o.ref)+'</span>'+(o.type==='استبدال'?' '+pill('lost','استبدال'):'')+'<br><span class="mono muted" style="font-size:11px">'+esc(o.wb)+'</span></td><td class="gov">'+esc(o.gov||'—')+'</td><td class="num">'+N(o.lines.length)+'</td><td class="num val">'+(val?'<span class="n">'+fmt(val)+'</span>':'<span class="muted">—</span>')+'</td><td>'+ordPill(o)+'</td></tr>';
  });
  return h;
}
/* ---------- v2: ledger as a document feed grouped by day ---------- */
function lgMini(mk,ms,pair,loc){
  const M=MODEL.get(mk),q={};let other=[];
  ms.forEach(m=>{const k=SKU.get(m.sku);if(k&&(m.from+'>'+m.to)===pair){(q[k.c]||(q[k.c]={}))[k.s]=(q[k.c][k.s]||0)+m.q}else other.push(m)});
  const cols=M?M.colors.filter(c=>q[c]):[],szs=M?M.sizes.filter(z=>cols.some(c=>q[c][z])):[];
  let h=cols.length?'<table class="lgx"><thead><tr><th></th>'+szs.map(z=>'<th>'+esc(z)+'</th>').join('')+'<th>إجمالي</th></tr></thead><tbody>'+cols.map(c=>'<tr><td class="cl">'+sw(c)+' '+esc(c)+'</td>'+szs.map(z=>q[c][z]?'<td><b class="n">'+q[c][z]+'</b></td>':'<td class="z">·</td>').join('')+'<td class="tt"><b class="n">'+szs.reduce((a,z)=>a+(q[c][z]||0),0)+'</b></td></tr>').join('')+'</tbody></table>':'';
  if(other.length)h+='<div class="lgc" style="margin-top:6px">'+other.map(m=>{const k=SKU.get(m.sku);return '<span class="lc">'+(k?sw(k.c)+' '+esc(k.c)+' · '+esc(k.s):esc(m.sku))+' <b class="n">×'+m.q+'</b> <span class="muted">← '+esc(loc(m.to))+'</span></span>'}).join('')+'</div>';
  return h;
}
function ledgerDocs(){
  const L=UI.led;L.open=L.open||{};const q=arN((L.q||'').trim()).split(/\s+/).filter(Boolean);let mv=S.moves;
  if(L.type)mv=mv.filter(m=>m.type===L.type);
  if(q.length)mv=mv.filter(m=>{const k=SKU.get(m.sku),hay=arN(m.sku+' '+(k?k.c+' '+k.s+' '+MODEL.get(k.m).name:''));return q.every(w=>SZ_SET[w]?(k&&k.s.toLowerCase()===w):hay.indexOf(w)>=0)});
  const G={};mv.forEach(m=>{const key=m.date+'|'+m.doc+'|'+m.type,g=G[key]||(G[key]={key,date:m.date,doc:m.doc,type:m.type,t:0,by:m.by,mv:[],pcs:0});g.mv.push(m);g.pcs+=m.q;if(m.t>g.t)g.t=m.t});
  const docs=Object.keys(G).map(k=>G[k]).sort((a,b)=>(a.date<b.date?1:a.date>b.date?-1:0)||b.t-a.t),byD={};docs.forEach(g=>{(byD[g.date]||(byD[g.date]=[])).push(g)});
  const days=Object.keys(byD).sort().reverse();if(!days.length)return '<div class="card"><div class="empty">مفيش حركات بالفلتر ده.</div></div>';
  const nd=L.nd||10,shown=days.slice(0,nd),GP={'دخول':'good','خروج':'info','داخلي':'warn','رقابة':'lost'};
  const loc=k=>LOC[k]||k;
  let h='<div class="tw"><table class="dt ledt"><thead><tr><th style="width:62px">الوقت</th><th>النوع</th><th>المستند</th><th>الوصف</th><th class="num">قطع</th><th>من ← إلى</th><th>الموظف</th><th style="width:28px"></th></tr></thead><tbody>';
  shown.forEach(d=>{
    const ms=byD[d].reduce((a,g)=>a.concat(g.mv),[]),inn=ms.filter(m=>m.to==='READY'&&String(m.from).indexOf('EXT_')===0).reduce((a,m)=>a+m.q,0),out=ms.filter(m=>m.from==='READY'&&String(m.to).indexOf('EXT_')===0).reduce((a,m)=>a+m.q,0);
    h+='<tr class="grp"><td colspan="8"><span class="row sp"><span><b>'+esc(dayName(d))+'</b> <span class="muted mono">'+esc(d)+'</span></span><span class="muted">'+byD[d].length+' مستند'+(inn?' · دخل <b class="n">'+fmt(inn)+'</b>':'')+(out?' · خرج <b class="n">'+fmt(out)+'</b>':'')+'</span></span></td></tr>';
    byD[d].forEach(g=>{
      const doc=S.docs.find(x=>x.no===g.doc||x.no+' (عكس)'===g.doc),isRev=/\(عكس\)/.test(g.doc||''),T=OT[g.type]||{ar:g.type,grp:''};
      const pairs={};g.mv.forEach(m=>{const k=m.from+'>'+m.to;pairs[k]=(pairs[k]||0)+m.q});const pk=Object.keys(pairs).sort((a,b)=>pairs[b]-pairs[a]),fl=pk.length?loc(pk[0].split('>')[0])+' ← '+loc(pk[0].split('>')[1])+(pk.length>1?' <span class="muted">+'+(pk.length-1)+'</span>':''):'';
      const nSku=new Set(g.mv.map(m=>m.sku)).size,notes=new Set(g.mv.map(m=>m.note)),desc=(g.type==='SCN'&&doc&&doc.hdr&&doc.hdr.refs?doc.hdr.refs.length+' أوردر':nSku+' صنف')+(notes.size===1&&g.mv[0].note?' · <span class="muted">'+esc(g.mv[0].note)+'</span>':'');
      const op=!!L.open[g.key];
      h+='<tr class="mrow lrow'+(op?' open':'')+'" data-a="ldoc" data-k="'+esc(g.key)+'" role="button" aria-expanded="'+op+'"><td class="mono muted">'+(g.t>1e12?timeOf(g.t):'')+'</td><td><span class="pill '+(GP[T.grp]||'')+'">'+esc(T.ar)+'</span>'+(isRev?' <span class="pill crit">عكس</span>':doc&&doc.status==='reversed'?' <span class="pill crit">اتعكس</span>':'')+'</td><td class="mono">'+esc(g.doc||'—')+'</td><td>'+desc+'</td><td class="num"><b class="n">'+fmt(g.pcs)+'</b></td><td class="flw">'+fl+'</td><td>'+esc(g.by||'')+'</td><td class="chev" aria-hidden="true">‹</td></tr>';
      if(op){const byM={};g.mv.forEach(m=>{const k=SKU.get(m.sku),mk=k?k.m:'؟';(byM[mk]||(byM[mk]=[])).push(m)});
        h+='<tr class="mopen"><td colspan="8">'+Object.keys(byM).sort((a,b)=>mkey(a)<mkey(b)?-1:1).map(mk=>'<div class="lgm"><span class="lgn"><b class="mono">'+esc(mk)+'</b> <span class="muted">'+esc(MODEL.get(mk)?MODEL.get(mk).name:'')+'</span> <span class="n muted">'+fmt(byM[mk].reduce((a,m)=>a+m.q,0))+'</span></span><span>'+lgMini(mk,byM[mk],pk[0],loc)+'</span></div>').join('')+(doc?'<div style="margin-top:8px"><button class="btn sm" data-a="opendoc" data-id="'+doc.id+'">افتح المستند</button></div>':'')+'</td></tr>'}
    });
  });
  h+='</tbody></table></div>';
  if(days.length>nd)h+='<div style="text-align:center;margin-top:12px"><button class="btn" data-a="ldmore">أيام أقدم ('+(days.length-nd)+')</button></div>';
  return h;
}
/* ---------- v2: supplies as a table, movements grouped by operation ---------- */
function supTable(items){
  return '<div class="tw"><table class="dt supt"><thead><tr><th>المستلزم</th><th class="num">الرصيد</th><th>يكفي</th><th class="num">بيتصرف/يوم</th><th class="num">حد التنبيه</th><th>الحالة</th><th></th></tr></thead><tbody>'+items.map(it=>{
    const b=supBal(it.id),u=supUse(it.id),c=supCover(it.id),k=supStatus(it),pt=packText(it,b);
    return '<tr style="'+(it.arch?'opacity:.7':'')+'"><td><b>'+esc(it.name)+'</b><br><span class="muted" style="font-size:12px" data-tip="قاعدة الخصم التلقائي">'+esc(ruleText(it))+'</span></td><td class="num"><b class="n" style="color:var(--'+(k==='good'?'ink':k)+')">'+fmt(b)+'</b> <span class="muted">'+esc(it.unit)+'</span>'+(pt?'<br><span class="muted" style="font-size:11px">= '+esc(pt)+'</span>':'')+'</td><td>'+(c!=null?'<span class="cvr">'+bar(Math.min(c,30),30,k==='good'?'g':k==='warn'?'w':'c')+'<span class="n">'+Math.floor(c)+'</span> <span class="muted" style="font-size:11px">يوم</span></span>':'<span class="muted">—</span>')+'</td><td class="num">'+(u?'<span class="n">'+u.toFixed(1)+'</span>':'<span class="muted">—</span>')+'</td><td class="num">'+(it.min?N(it.min):'<span class="muted">—</span>')+'</td><td>'+(it.arch?pill('','مؤرشف'):sd(k)+'<span class="sdt">'+(k==='crit'?(b<0?'بالسالب':'خلص'):k==='warn'?'قرب يخلص':'تمام')+'</span>')+'</td><td><span class="row" style="justify-content:flex-end;flex-wrap:nowrap">'+(it.arch?'<button class="btn sm" data-a="suprestore" data-id="'+it.id+'">استرجاع</button>':'<button class="btn sm pri" data-a="supopen" data-id="'+it.id+'" data-act="rcv">+ استلام</button><button class="btn sm" data-a="supopen" data-id="'+it.id+'" data-act="manage">إدارة</button>')+'</span></td></tr>'}).join('')+'</tbody></table></div>';
}
function supLogGrouped(){
  const G={},order=[];S.sup.log.slice(-200).forEach(e=>{const key=e.doc?(e.date+'|'+e.doc+'|'+e.kind+'|'+e.why):('x'+e.id);let g=G[key];if(!g){g=G[key]={date:e.date,kind:e.kind,why:e.why,by:e.by,rev:e.rev,e:[],t:e.t};order.push(key)}g.e.push(e)});
  const rows=order.map(k=>G[k]).reverse().slice(0,40);
  return '<div class="tw"><table class="dt"><thead><tr><th>التاريخ</th><th>النوع</th><th>السبب</th><th>التغيير</th></tr></thead><tbody>'+rows.map(g=>'<tr style="'+(g.rev?'opacity:.55;text-decoration:line-through':'')+'"><td class="mono" style="white-space:nowrap">'+esc(g.date)+'</td><td>'+pill(KIND_P[g.kind]||'',KIND_L[g.kind]||g.kind)+'</td><td class="muted">'+esc(g.why)+'</td><td><span class="lgc">'+g.e.map(e=>'<span class="lc">'+esc(supName(e.item))+' <b class="n" style="color:var(--'+(e.q<0?'crit':'good')+')">'+(e.q>0?'+':'')+e.q+'</b></span>').join('')+'</span></td></tr>').join('')+'</tbody></table></div>';
}
function supStrip(items){
  const st=items.map(i=>supStatus(i)),n=k=>st.filter(x=>x===k).length;
  return strip([si('المستلزمات',N(items.length),'نشطة'),si('تمام',N(n('good')),'',n('good')===items.length?'good':''),si('قرب يخلص',N(n('warn')),'',n('warn')?'warn':''),si('خلص أو بالسالب',N(n('crit')),'',n('crit')?'crit':'')]);
}
/* ---------- v2: settings in sections ---------- */
function vConfig(){
  const html=vConfigOrig(),secs=html.match(/<section class="card"[^>]*>[\s\S]*?<\/section>/g)||[],by={};
  secs.forEach(x=>{const t=((x.match(/<h2>([^<]+)/)||[])[1]||'').trim();by[t]=x});
  const head=html.slice(0,html.indexOf('<div class="grid g2">')),T=[['plan','التنبيهات والتخطيط',['التنبيهات']],['sup','المستلزمات',['المستلزمات']],['cost','التكلفة والأسعار',['التكلفة وسعر البيع']],['sys','المستخدمين والبيانات',['المستخدمين','البيانات']]],cur=UI.cfgTab||'plan',tab=T.find(t=>t[0]===cur)||T[0];
  return head+'<div class="tabs" role="tablist">'+T.map(t=>'<button role="tab" aria-selected="'+(t[0]===tab[0])+'" data-a="cfgtab" data-v="'+t[0]+'">'+t[1]+'</button>').join('')+'</div><div class="stack" style="max-width:980px">'+tab[2].map(n=>(by[n]||'').replace(' style="margin-top:16px"','').replace(/max-height:\s*\d+px;?/,'')).join('')+'</div>';
}
