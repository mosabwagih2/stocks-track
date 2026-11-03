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
  const cmp=(a,b)=>s.sort==='alpha'?(mIdx[a]-mIdx[b]):(prioK(by[a].k)-prioK(by[b].k)||by[b].rate-by[a].rate||mIdx[a]-mIdx[b]);
  const nCrit=ms.filter(c=>by[c].k==='crit').length,nWarn=ms.filter(c=>by[c].k==='warn').length,need=ms.reduce((a,c)=>a+by[c].need,0);
  const dmTot=ms.reduce((a,c)=>a+by[c].dm,0),stTot=ms.reduce((a,c)=>a+sv(c),0);
  let h=strip([si('الموديلات',N(ms.length),sq?'من '+all.length:LINE_ORDER.filter(l=>groups[l]).length+' خط'),si(LOC[s.state],N(stTot),'قطعة'),si('طلب مفتوح',N(dmTot),'قطعة'),si('اطلب تصنيع',N(nCrit),nWarn?nWarn+' كمان قربوا':'موديل',nCrit?'crit':nWarn?'warn':'good'),si('مقترح تصنيعه',N(need),'قطعة',need?'warn':'')]);
  if(!ms.length)return h+'<div class="card"><div class="empty">مفيش نتيجة'+(sq?' لـ "'+esc(s.q.trim())+'"':'')+'.</div></div>';
  const openN=ms.filter(c=>s.open[c]).length;
  h+='<div class="row sp" style="margin:4px 0 10px"><span class="muted" style="font-size:13px">اضغط على أي موديل يفتح المصفوفة بتاعته</span><span class="row"><button class="btn sm" data-a="mexpall">'+(openN===ms.length?'اقفل الكل':'افتح الكل')+'</button></span></div>';
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
