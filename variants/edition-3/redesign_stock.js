/* ---------- v2: shared pieces ---------- */
const strip=items=>'<div class="strip">'+items.join('')+'</div>';
const si=(l,v,s,k,act)=>(act?'<button type="button" data-a="'+act.split(':')[0]+'" data-w="'+(act.split(':')[1]||'')+'" data-v="'+(act.split(':')[1]||'')+'"':'<div')+' class="si '+(k||'')+'"><small>'+l+'</small><b>'+v+'</b>'+(s?'<em>'+s+'</em>':'')+(act?'</button>':'</div>');
const sd=k=>'<i class="sd '+(k||'n')+'" aria-hidden="true"></i>';
const prioK=k=>({crit:0,warn:1,good:2,info:3,'':4})[k]!=null?({crit:0,warn:1,good:2,info:3,'':4})[k]:4;
const bar=(v,max,k)=>'<span class="rb" aria-hidden="true"><i class="'+(k||'')+'" style="width:'+(max?Math.max(2,Math.min(100,v/max*100)).toFixed(1):0)+'%"></i></span>';
/* ---------- v2: stock as a grouped list, one row per model, matrix on demand ---------- */
function stockList(){
  const s=UI.s,sq=stockQ(),R=rateData(),by={};R.rows.forEach(r=>by[r.m]=r);
  UI.s.open=UI.s.open||{};
  const all=MORDER.filter(c=>by[c]),ms=all.filter(c=>!sq||modelHit(c,sq));
  const groups={};ms.forEach(c=>{(groups[lineOf(c)]||(groups[lineOf(c)]=[])).push(c)});
  const sv=c=>s.state==='READY'?by[c].ready:mSum(c,s.state);
  const cmp=(a,b)=>s.sort==='alpha'?(mIdx[a]-mIdx[b]):(by[b].rate-by[a].rate||mIdx[a]-mIdx[b]);
  const nCrit=ms.filter(c=>by[c].k==='crit').length,nWarn=ms.filter(c=>by[c].k==='warn').length,need=ms.reduce((a,c)=>a+by[c].need,0);
  const dmTot=ms.reduce((a,c)=>a+by[c].dm,0),stTot=ms.reduce((a,c)=>a+sv(c),0);
  let h=strip([si('الموديلات',N(ms.length),sq?'من '+all.length:LINE_ORDER.filter(l=>groups[l]).length+' خط'),si(LOC[s.state],N(stTot),'قطعة'),si('طلب مفتوح',N(dmTot),'قطعة'),si('اطلب تصنيع',N(nCrit),nWarn?nWarn+' كمان قربوا':'موديل',nCrit?'crit':nWarn?'warn':'good'),si('مقترح تصنيعه',N(need),'قطعة',need?'warn':'')]);
  if(!ms.length)return h+'<div class="card"><div class="empty">مفيش نتيجة'+(sq?' لـ "'+esc(s.q.trim())+'"':'')+'.</div></div>';
  const openN=ms.filter(c=>s.open[c]).length;
  h+='<div class="row sp" style="margin:4px 0 10px"><span class="muted" style="font-size:13px">اضغط على أي موديل يفتح المصفوفة بتاعته</span><span class="row" style="gap:8px"><span class="seg" role="group" aria-label="الترتيب"><button aria-pressed="'+(s.sort!=='alpha')+'" data-a="ssort" data-v="pull">الأكثر سحبًا</button><button aria-pressed="'+(s.sort==='alpha')+'" data-a="ssort" data-v="alpha">أبجدي</button></span><button class="btn sm" data-a="mexpall">'+(openN===ms.length?'اقفل الكل':'افتح الكل')+'</button></span></div>';
  h+='<div class="tw"><table class="dt stkl"><thead><tr><th>الموديل</th><th class="num">'+LOC[s.state]+'</th><th class="num">طلب مفتوح</th><th class="num">سحب/أسبوع</th><th>التغطية</th><th>الحالة</th><th style="width:28px"></th></tr></thead><tbody>';
  LINE_ORDER.filter(l=>groups[l]).forEach(l=>{
    const g_=groups[l].slice().sort(cmp),att=g_.filter(c=>by[c].k==='crit'||by[c].k==='warn').length,sum=g_.reduce((a,c)=>a+sv(c),0);
    h+='<tr class="grp"><td colspan="7"><span class="row sp"><span><b>'+esc(l)+'</b> <span class="muted">· '+g_.length+' موديل</span></span><span class="muted">'+(att?'<span class="pill warn" style="margin-inline-end:8px">'+att+' محتاج انتباه</span>':'')+'<span class="n">'+fmt(sum)+'</span> قطعة</span></span></td></tr>';
    g_.forEach(c=>{const r=by[c],op=!!s.open[c],cov=r.cover;
      h+='<tr class="mrow'+(op?' open':'')+'" data-a="mexp" data-m="'+c+'" role="button" aria-expanded="'+op+'"><td><span class="row" style="flex-wrap:nowrap;gap:10px">'+thumb(c,34)+'<span><b class="mono">'+c+'</b> <span class="muted">'+esc(MODEL.get(c).name)+'</span>'+(r.label==='—'?'':'<span class="mo sdt">'+sd(r.k)+esc(r.label)+'</span>')+'</span></span></td>'
       +'<td class="num"><b class="n">'+fmt(sv(c))+'</b></td><td class="num">'+(r.dm?N(r.dm):'<span class="muted">0</span>')+'</td><td class="num">'+(r.rate>0?N(Math.round(r.rate)):'<span class="muted">—</span>')+'</td>'
       +'<td>'+(cov==null?'<span class="muted">—</span>':'<span class="cvr">'+bar(cov,12,r.k==='crit'?'c':r.k==='warn'?'w':'g')+'<span class="n">'+(cov>=99?'99+':cov.toFixed(1))+'</span><span class="muted" style="font-size:11px"> أسبوع</span></span>')+'</td>'
       +'<td>'+(r.label==='—'?'':sd(r.k)+'<span class="sdt">'+esc(r.label)+'</span>')+'</td><td class="chev" aria-hidden="true">‹</td></tr>';
      if(op)h+='<tr class="mopen"><td colspan="7"><div class="mhead"><span class="muted">'+esc(mName(c))+' · '+LOC[s.state]+'</span><button class="btn sm" data-a="skuadd" data-m="'+c+'">+ لون / مقاس</button></div>'+matrixHTML(MODEL.get(c))+'</td></tr>';
    });
  });
  return h+'</tbody></table></div>'+matrixLegend;
}
/* ---------- v2: stock heat map (model x size): available, short, enough, surplus at a glance ---------- */
const HC={out:'var(--c-scrap)',low:'var(--c-dirty)',ok:'var(--c-ready)',excess:'var(--c-factory)'};
function heatCells(){
  const C=ctx(),E=skuStats().m,PR=planRows(),needBy={},cell={};
  PR.forEach(r=>{const k=SKU.get(r.id),key=k.m+'|'+k.s;needBy[key]=(needBy[key]||0)+r.q});
  D.skus.forEach(k=>{const key=k.m+'|'+k.s,c=cell[key]||(cell[key]={m:k.m,s:k.s,R:0,dm:0,fac:0,rop:0,rd:0,n:0,P:0});const e=E[k.id]||{rd:0,rop:0};
    c.R+=g(k.id,'READY');c.P+=g(k.id,UI.s.state);c.dm+=C.demand[k.id]||0;c.fac+=g(k.id,'FACTORY');c.rop+=e.rop;c.rd+=e.rd;c.n++});
  Object.keys(cell).forEach(key=>{const c=cell[key],dem=c.rd>0||c.dm>0,pos=c.R-c.dm+c.fac;c.need=needBy[key]||0;c.cover=c.rd>0?Math.max(0,c.R-c.dm)/c.rd/7:null;
    c.surplus=Math.max(0,c.R-Math.ceil(c.rd*S.st.excess));c.dead=c.rd===0&&c.dm===0&&c.R>0;
    if(!dem&&c.R<=0&&c.fac<=0){c.st='none';c.t=0}
    else if(dem&&c.R-c.dm<=0){c.st='out';c.t=.8}
    else if(dem&&pos<=c.rop){c.st='low';c.t=Math.max(.35,Math.min(.85,.35+.5*(1-(c.rop>0?pos/c.rop:0))))}
    else if(c.dead||(c.rd>0&&c.surplus>0&&(c.R-c.dm)/c.rd>S.st.excess)){c.st='excess';const ratio=c.rd>0?(c.R-c.dm)/c.rd/S.st.excess:3;c.t=c.dead?.13:Math.max(.2,Math.min(.5,.2+.1*(Math.min(4,ratio)-1)))}
    else{c.st='ok';c.t=.3}});
  const mxP=Math.max(1,...Object.keys(cell).map(k=>cell[k].P));if(UI.s.state!=='READY')Object.keys(cell).forEach(k=>{const c=cell[k];c.st=c.P>0?'ok':'none';c.t=c.P>0?Math.min(.6,.1+c.P/mxP*.5):0});
  return cell;
}
function stockHeat(){
  const s=UI.s,sq=stockQ(),mode=s.hm||'avail',cell=heatCells();
  const SZ=D.sizes,R0=rateData(),rt={};R0.rows.forEach(r=>rt[r.m]=r.rate||0);
  const ms=MORDER.filter(c=>!sq||modelHit(c,sq));if(s.sort!=='alpha')ms.sort((a,b)=>(rt[b]||0)-(rt[a]||0)||mIdx[a]-mIdx[b]);
  const cnt={out:0,low:0,ok:0,excess:0};ms.forEach(m=>SZ.forEach(z=>{const c=cell[m+'|'+z];if(c&&cnt[c.st]!=null)cnt[c.st]++}));
  const val=c=>mode==='avail'?c.P:mode==='cover'?(c.cover==null?0:Math.min(99,c.cover)):c.need;
  const szs=SZ.filter(z=>ms.some(m=>{const c=cell[m+'|'+z];return c&&(c.P||c.st!=='none')}));
  const mx=Math.max(1,...ms.map(m=>Math.max(0,...szs.map(z=>{const c=cell[m+'|'+z];return c?val(c):0}))));
  const col={};szs.forEach(z=>{col[z]={P:0,bad:0};ms.forEach(m=>{const c=cell[m+'|'+z];if(!c)return;col[z].P+=c.P;if(c.st==='out'||c.st==='low')col[z].bad++})});
  const DOT={out:'crit',low:'warn',excess:'info'},TX={out:'ناقص',low:'تحت نقطة الطلب',excess:'زيادة / راكد'};
  let h=strip([si('ناقص (خلصان وعليه طلب)',N(cnt.out),'خانة',cnt.out?'crit':'good'),si('تحت نقطة الطلب',N(cnt.low),'خانة',cnt.low?'warn':'good'),si('تمام',N(cnt.ok),'خانة','good'),si('زيادة عن اللازم',N(cnt.excess),'خانة (فوق '+S.st.excess+' يوم تغطية أو راكد)')]);
  const sub=mode==='avail'?'كل خانة هي عدد القطع المتاحة. اللون الأغمق يعني مخزون أكتر.':mode==='cover'?'كل خانة هي عدد أسابيع التغطية. اللون الأغمق يعني تغطية أطول.':'كل خانة هي عدد القطع المطلوب تصنيعها. اللون الأغمق يعني احتياج أكبر.';
  const seg='<div class="seg" role="group" aria-label="المعروض في الخانة"><button aria-pressed="'+(mode==='avail')+'" data-a="hmode" data-v="avail">المتاح</button><button aria-pressed="'+(mode==='cover')+'" data-a="hmode" data-v="cover">التغطية (أسبوع)</button><button aria-pressed="'+(mode==='need')+'" data-a="hmode" data-v="need">المطلوب تصنيعه</button></div>';
  const srt='<div class="seg" role="group" aria-label="ترتيب الموديلات"><button aria-pressed="'+(s.sort!=='alpha')+'" data-a="ssort" data-v="pull">الأكثر سحبًا</button><button aria-pressed="'+(s.sort==='alpha')+'" data-a="ssort" data-v="alpha">أبجدي</button></div>';
  if(!ms.length)return h+'<div class="card"><div class="empty">مفيش نتيجة.</div></div>';
  const tbl='<div class="tw"><table class="hm hms"><thead><tr><th></th>'+szs.map(z=>'<th>'+z+'</th>').join('')+'<th>الإجمالي</th></tr></thead><tbody>'+ms.map(m=>'<tr><th style="text-align:start;background:none;position:static"><b class="mono">'+esc(m)+'</b></th>'+szs.map(z=>{
    const c=cell[m+'|'+z];if(!c)return '<td></td>';const v=val(c),a=Math.round(v/mx*88),shown=mode==='cover'?(c.cover==null?'':(c.cover>=99?'99+':c.cover.toFixed(1))):(v?fmt(v):'');
    const tip=mName(m)+' · '+z+': '+fmt(c.P)+' قطعة'+(TX[c.st]?' · '+TX[c.st]:'')+(c.need?' · يتصنّع '+fmt(c.need):'');
    return '<td class="hmc'+(v?'':' z')+'" data-a="hcell" data-m="'+m+'" data-z="'+z+'" data-st="'+c.st+'" title="'+esc(tip)+'" tabindex="0" style="background:'+(v?'color-mix(in srgb,var(--accent) '+a+'%,var(--surface))':'var(--grid)')+';color:'+(a>50?'var(--on-accent)':'var(--ink)')+'">'+shown+'</td>'}).join('')+'<td style="text-align:center;font:600 12px var(--f-mono)">'+fmt(mSum(m,s.state))+'</td></tr>').join('')
    +'<tr class="hf"><th style="text-align:start;background:none;position:static"><b>الإجمالي</b></th>'+szs.map(z=>'<td class="hft"><b class="n">'+fmt(col[z].P)+'</b></td>').join('')+'<td class="hft"><b class="n">'+fmt(szs.reduce((a,z)=>a+col[z].P,0))+'</b></td></tr></tbody></table></div>';
  h+=card('خريطة المخزون: الموديل × المقاس','<p class="muted" style="margin:0 0 10px;font-size:12.5px">'+sub+'</p><div class="row" style="margin:0 0 10px;gap:10px;flex-wrap:wrap">'+seg+srt+'</div>'+tbl+'<p class="muted" style="margin:8px 0 0;font-size:12px">الخانة بتجمع كل ألوان الموديل في المقاس ده. اضغط عليها تشوف الألوان.</p>');
  return h;
}
function heatSheet(m,z){
  const E=skuStats().m,C=ctx(),ks=D.skus.filter(k=>k.m===m&&k.s===z),PR=planRows(),nb={};PR.forEach(r=>nb[r.id]=r.q);
  const rows=ks.map(k=>{const e=E[k.id]||{rd:0,rop:0},i=info(k.id),R=g(k.id,'READY'),pos=R-i.dm+g(k.id,'FACTORY'),dem=e.rd>0||i.dm>0;
    const st=!dem&&R<=0?'none':dem&&R-i.dm<=0?'out':dem&&pos<=e.rop?'low':(e.rd===0&&R>0)||(e.rd>0&&(R-i.dm)/e.rd>S.st.excess)?'excess':'ok';
    return {k,R,dm:i.dm,fac:g(k.id,'FACTORY'),rate:e.rd*7,cover:e.rd>0?Math.max(0,R-i.dm)/e.rd/7:null,need:nb[k.id]||0,st}});
  const L={out:'ناقص',low:'تحت نقطة الطلب',ok:'تمام',excess:'زيادة / راكد',none:'—'};
  return {title:mName(m)+' · مقاس '+z,body:'<div class="tw"><table class="t-sm"><thead><tr><th>اللون</th><th class="num">متاح</th><th class="num">طلب مفتوح</th><th class="num">عند المصنع</th><th class="num">سحب/أسبوع</th><th class="num">تغطية</th><th class="num">يتصنّع</th><th>الحالة</th></tr></thead><tbody>'+rows.map(r=>'<tr data-a="sku" data-sku="'+r.k.id+'"><td>'+sw(r.k.c)+' '+esc(r.k.c)+'</td><td class="num"><b class="n">'+fmt(r.R)+'</b></td><td class="num">'+N(r.dm)+'</td><td class="num">'+N(r.fac)+'</td><td class="num">'+(r.rate>0?'<span class="n">'+r.rate.toFixed(1)+'</span>':'<span class="muted">—</span>')+'</td><td class="num">'+(r.cover==null?'<span class="muted">—</span>':'<span class="n">'+(r.cover>=99?'99+':r.cover.toFixed(1))+'</span>')+'</td><td class="num">'+(r.need?'<span class="pill warn">'+fmt(r.need)+'</span>':'<span class="muted">0</span>')+'</td><td>'+(r.st==='none'?'':'<i class="sd '+(r.st==='out'?'crit':r.st==='low'?'warn':r.st==='excess'?'info':'good')+'"></i><span class="sdt">'+L[r.st]+'</span>')+'</td></tr>').join('')+'</tbody></table></div><p class="muted" style="font-size:12px">اضغط على أي لون يفتح تفاصيل الصنف.</p>'};
}
