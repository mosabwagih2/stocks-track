/* ---------- v2: returns by waybill. A parcel = one order, counted piece by piece against what was shipped. ---------- */
const RT_ST=[['r','سليم','good'],['d','نضافة','warn'],['x','هالك','crit'],['m','ناقص','lost']];
const rtnFind=c=>{const k=String(c||'').trim().replace(/[#\s]/g,'').toLowerCase();if(!k)return null;return S.orders.find(o=>String(o.ref).toLowerCase()===k||String(o.wb).replace(/\s/g,'')===k)||null};
function rtnSync(d){
  const H=d.hdr,P=H.parcels||[],m={},L=sku=>m[sku]||(m[sku]={sku,exp:0,r:0,d:0,x:0});
  P.forEach(p=>p.items.forEach(it=>{const l=L(it.sku);l.exp++;if(it.st==='r')l.r++;else if(it.st==='d')l.d++;else if(it.st==='x')l.x++}));
  (H.extra||[]).forEach(e=>{const l=L(e.sku);if(e.st==='r')l.r++;else if(e.st==='d')l.d++;else if(e.st==='x')l.x++});
  d.lines=Object.keys(m).sort(skuSort).map(k=>m[k]);H.refs=P.map(p=>p.ref);H.counted=P.length>0&&P.every(p=>p.items.every(i=>i.st));
}
function rtnAddCodes(d,codes){
  const H=d.hdr;H.parcels=H.parcels||[];H.msgs=[];let n=0;
  codes.forEach(c=>{const o=rtnFind(c);
    if(!o){H.msgs.push({k:'crit',t:'البوليصة '+c+': مش لاقي أوردر بالرقم ده في الأوردرات.'});return}
    if(H.parcels.some(p=>p.ref===o.ref)){H.msgs.push({k:'warn',t:'البوليصة '+o.wb+' (أوردر '+o.ref+') مضافة هنا بالفعل.'});return}
    if(o.st==='cx'){H.msgs.push({k:'crit',t:'أوردر '+o.ref+' ملغي. مينفعش يتسجّل مرتجع.'});return}
    if(o.st==='open'){H.msgs.push({k:'crit',t:'أوردر '+o.ref+' ما اتشحنش لسه (مفيش سكان ليه)، فمفيش حاجة مفروض ترجع.'});return}
    if(o.rt){H.msgs.push({k:'warn',t:'أوردر '+o.ref+' اتسجّل مرتجع قبل كده في '+o.rt.doc+'.'});return}
    const other=S.docs.find(x=>x.id!==d.id&&x.type==='RTN'&&x.status==='draft'&&(x.hdr.parcels||[]).some(p=>p.ref===o.ref));
    if(other){H.msgs.push({k:'warn',t:'أوردر '+o.ref+' موجود في مسودة مرتجع تانية.'});return}
    if(!H.parcels.length){const pk=S.pickups.find(p=>p.id===o.pk);if(pk&&pk.channel)H.channel=pk.channel}
    H.parcels.push({id:'p'+(Date.now().toString(36))+H.parcels.length,ref:o.ref,wb:o.wb,items:o.lines.map(sku=>({sku,st:''}))});n++});
  rtnSync(d);dirty();return n;
}
function rtnStats(d){
  const P=(d.hdr.parcels||[]),it=[].concat(...P.map(p=>p.items)),ex=d.hdr.extra||[];
  const c=s=>it.filter(i=>i.st===s).length;
  return {parcels:P.length,exp:it.length,r:c('r'),d:c('d'),x:c('x'),m:c('m'),pending:it.filter(i=>!i.st).length,extra:ex.length,got:c('r')+c('d')+c('x')};
}
function rtnOutcome(d,o){
  const p=((d.hdr||{}).parcels||[]).find(x=>x.ref===o.ref);if(!p)return {doc:d.no,date:d.date};
  const exp=p.items.length,got=p.items.filter(i=>i.st==='r'||i.st==='d'||i.st==='x').length;return {doc:d.no,date:d.date,exp,got,miss:exp-got};
}
function rtnParcels(d,draft){
  const H=d.hdr,P=H.parcels||[],st=rtnStats(d),dis=draft?'':' disabled';
  let h='';
  if(draft){
    h+='<section class="card"><h2>رقم البوليصة <span class="hint">اسكن أو اكتب، وهتظهر الأوردر وقطعه</span></h2><div class="row" style="gap:8px;flex-wrap:nowrap"><input id="rtnwb" type="text" inputmode="numeric" autocomplete="off" placeholder="رقم البوليصة أو كود الأوردر" aria-label="رقم البوليصة" style="flex:1;min-width:0;font-size:16px"><button class="btn pri" data-a="rtnadd">أضف</button></div>'
     +'<p class="muted" style="margin:8px 0 0;font-size:12.5px">كل بوليصة = أوردر. السيستم بيعرف إيه اللي اتشحن فيه، وانت بتعدّ اللي رجع قطعة قطعة. تقدر تلزق كذا رقم مرة واحدة.</p>'
     +((H.msgs||[]).length?'<div style="display:grid;gap:6px;margin-top:10px">'+H.msgs.map(m=>'<div class="msg '+m.k+'">'+esc(m.t)+'</div>').join('')+'</div>':'')+'</section>';
  }
  if(P.length||!draft){
    h+='<div class="strip" style="margin-bottom:14px">'+[si('بوالص',N(st.parcels),''),si('متوقع',N(st.exp),'قطعة'),si('استلمنا',N(st.got),'قطعة · سليم '+st.r+' · نضافة '+st.d+' · هالك '+st.x,'good'),si('ناقص',N(st.m),'قطعة',st.m?'crit':'good'),si(draft?'لسه ما اتعدش':'زيادة',N(draft?st.pending:st.extra),'قطعة',(draft?st.pending:st.extra)?'warn':'')].concat(draft&&st.extra?[si('زيادة',N(st.extra),'قطعة','warn')]:[]).join('')+'</div>';
    const diff=P.map(p=>{const m=p.items.filter(i=>i.st==='m'),e=0;return m.length?{p,m}:null}).filter(Boolean);
    if(st.m||st.extra){h+='<div class="msg warn" style="margin-bottom:14px"><b>فيه فرق بين اللي اتشحن واللي استلمناه:</b><ul style="margin:6px 0 0;padding-inline-start:18px">'+diff.map(x=>'<li>أوردر <b class="mono">'+esc(x.p.ref)+'</b> (بوليصة '+esc(x.p.wb)+'): ناقص '+x.m.map(i=>esc(skuName(i.sku))).join('، ')+'</li>').join('')+(st.extra?'<li>زيادة '+st.extra+' قطعة مش من الأوردرات</li>':'')+'</ul><div style="margin-top:6px;font-size:12.5px">الناقص بيتسجّل <b>مفقود</b> ومربوط بالقناة والأوردر.</div></div>'}
    if(draft&&st.pending)h+='<div class="row" style="margin-bottom:12px"><button class="btn" data-a="rtnallall">كل اللي لسه ما اتعدّش: سليم ('+st.pending+')</button></div>';
  }
  h+=P.map(p=>{const o=orderByRef(p.ref),pend=p.items.filter(i=>!i.st).length,mis=p.items.filter(i=>i.st==='m').length,got=p.items.filter(i=>'rdx'.indexOf(i.st)>=0&&i.st).length;
    const pill_=pend?pill('','لسه ما اتعدّش'):mis?pill('crit','ناقص '+mis+' من '+p.items.length):pill('good','مطابق ✓');
    return '<section class="card rpc"><div class="row sp" style="margin-bottom:8px"><span><b class="mono">'+esc(p.wb)+'</b> <span class="muted">· أوردر</span> <span class="mono">'+esc(p.ref)+'</span>'+(o&&o.gov?' <span class="muted">· '+esc(o.gov)+'</span>':'')+(o?' <span class="muted">· '+EGP(ordVal(o))+'</span>':'')+'</span><span class="row" style="gap:8px">'+pill_+(draft?'<button class="btn sm ghost" data-a="rtnrm" data-p="'+p.id+'" aria-label="شيل البوليصة">✕</button>':'')+'</span></div>'
     +'<div class="rpl">'+p.items.map((it,i)=>'<div class="rpi"><span class="rpn">'+thumb(SKU.get(it.sku).m,26)+' '+sw(SKU.get(it.sku).c)+' '+esc(skuName(it.sku))+'</span><span class="seg rps" role="group" aria-label="حالة القطعة">'+RT_ST.map(s=>'<button aria-pressed="'+(it.st===s[0])+'" data-a="rtnst" data-p="'+p.id+'" data-i="'+i+'" data-v="'+s[0]+'" class="rs-'+s[0]+'"'+dis+'>'+s[1]+'</button>').join('')+'</span></div>').join('')+'</div>'
     +(draft&&pend?'<div style="margin-top:8px"><button class="btn sm" data-a="rtnall" data-p="'+p.id+'">كله سليم</button></div>':'')+'</section>'}).join('');
  if(draft){
    h+='<section class="card"><h2>قطع زيادة <span class="hint">اختياري · رجعت من غير ما تكون في الأوردر</span></h2><input data-c="rtnextra" list="rtnsk" placeholder="اكتب الصنف: BR2 احمر L" aria-label="صنف زيادة" style="width:100%;max-width:360px"><datalist id="rtnsk">'+D.skus.map(k=>'<option value="'+esc(skuName(k.id))+'">').join('')+'</datalist>'
     +((H.extra||[]).length?'<div style="display:grid;gap:6px;margin-top:10px">'+H.extra.map((e,i)=>'<div class="rpi"><span class="rpn">'+sw(SKU.get(e.sku).c)+' '+esc(skuName(e.sku))+'</span><span class="row" style="gap:6px"><span class="seg rps">'+RT_ST.slice(0,3).map(s=>'<button aria-pressed="'+(e.st===s[0])+'" data-a="rtnxst" data-i="'+i+'" data-v="'+s[0]+'" class="rs-'+s[0]+'">'+s[1]+'</button>').join('')+'</span><button class="btn sm ghost" data-a="rtnxrm" data-i="'+i+'" aria-label="شيل">✕</button></span></div>').join('')+'</div>':'')+'</section>';
  }else if((H.extra||[]).length)h+='<section class="card"><h2>قطع زيادة</h2>'+H.extra.map(e=>'<div>'+esc(skuName(e.sku))+' · '+esc((RT_ST.find(s=>s[0]===e.st)||[])[1]||'')+'</div>').join('')+'</section>';
  return h;
}
function rtnOrderBlock(o){
  if(!o.rt)return '';const doc=S.docs.find(x=>x.no===o.rt.doc),p=doc&&(doc.hdr.parcels||[]).find(x=>x.ref===o.ref);
  let h='<div class="msg '+(o.rt.miss?'warn':'good')+'"><b>المرتجع</b> · '+esc(o.rt.doc)+' · '+esc(o.rt.date||'')+(o.rt.exp!=null?'<br>استلمنا '+o.rt.got+' من '+o.rt.exp+' قطعة'+(o.rt.miss?' · ناقص '+o.rt.miss+' (اتسجّل مفقود)':' · مطابق'):'')+'</div>';
  if(p)h+='<div class="tw"><table class="t-sm"><tbody>'+p.items.map(i=>'<tr><td>'+sw(SKU.get(i.sku).c)+' '+esc(skuName(i.sku))+'</td><td>'+esc((RT_ST.find(s=>s[0]===i.st)||[,'—'])[1])+'</td></tr>').join('')+'</tbody></table></div>';
  return h;
}
const ACT_RT={
  rtnadd:()=>{const d=curDoc(),i=document.getElementById('rtnwb');if(!d||d.status!=='draft')return;const codes=String(i?i.value:'').split(/[\s,;]+/).map(x=>x.trim()).filter(Boolean);if(!codes.length)return;rtnAddCodes(d,codes);render();setTimeout(()=>{const x=document.getElementById('rtnwb');if(x){x.value='';x.focus()}},30)},
  rtnfill:()=>{const d=curDoc();if(!d||d.status!=='draft')return;rtnAddCodes(d,String(d.hdr.codes||'').split(/[\s,;]+/).map(x=>x.trim()).filter(Boolean));render()},
  rtnst:el=>{const d=curDoc();if(!d||d.status!=='draft')return;const p=d.hdr.parcels.find(x=>x.id===el.dataset.p);if(!p)return;const it=p.items[+el.dataset.i];it.st=it.st===el.dataset.v?'':el.dataset.v;rtnSync(d);dirty();render()},
  rtnall:el=>{const d=curDoc(),p=d&&d.hdr.parcels.find(x=>x.id===el.dataset.p);if(!p)return;p.items.forEach(i=>{if(!i.st)i.st='r'});rtnSync(d);dirty();render()},
  rtnallall:()=>{const d=curDoc();if(!d)return;d.hdr.parcels.forEach(p=>p.items.forEach(i=>{if(!i.st)i.st='r'}));rtnSync(d);dirty();render()},
  rtnrm:el=>{const d=curDoc();if(!d)return;d.hdr.parcels=d.hdr.parcels.filter(x=>x.id!==el.dataset.p);rtnSync(d);dirty();render()},
  rtnxst:el=>{const d=curDoc();if(!d)return;const e=d.hdr.extra[+el.dataset.i];if(e)e.st=el.dataset.v;rtnSync(d);dirty();render()},
  rtnxrm:el=>{const d=curDoc();if(!d)return;d.hdr.extra.splice(+el.dataset.i,1);rtnSync(d);dirty();render()},
  rtnsheetadd:()=>{const d=curDoc(),H=d.hdr;if(!d||d.status!=='draft'||!H.sheet)return;const codes=[];H.sheet.rows.forEach(r=>{const m=rtnMatch(d,r);if(m.k==='ok')codes.push(m.o.ref)});const n=rtnAddCodes(d,codes);if(n){d.log.push(logE('اتضافت '+n+' بوليصة من شيت الشحن'));toast('اتضاف '+n+' بوليصة. عدّ القطع بقى.')}render()}
};
const CHG_RT={
  rtnextra:el=>{const d=curDoc();if(!d||d.status!=='draft')return;const k=D.skus.find(k=>skuName(k.id)===el.value.trim());el.value='';if(!k)return;d.hdr.extra=d.hdr.extra||[];d.hdr.extra.push({sku:k.id,st:'r'});rtnSync(d);dirty();render()}
};
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target&&e.target.id==='rtnwb'){e.preventDefault();ACT_RT.rtnadd()}});
