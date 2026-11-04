/* ---------- v2: returns by waybill. A parcel = one order, counted piece by piece against what was shipped. ---------- */
const RT_ST=[['r','سليم','good'],['d','نضافة','warn'],['x','هالك','crit'],['m','ناقص','lost']];
const rtnFind=c=>{const k=String(c||'').trim().replace(/[#\s]/g,'').toLowerCase();if(!k)return null;return S.orders.find(o=>String(o.ref).toLowerCase()===k||String(o.wb).replace(/\s/g,'')===k)||null};
function rtnSync(d){
  const H=d.hdr,P=H.parcels||[],m={},L=sku=>m[sku]||(m[sku]={sku,exp:0,r:0,d:0,x:0,par:true}),man=d.lines.filter(l=>!l.par);
  P.forEach(p=>p.items.forEach(it=>{const l=L(it.sku);l.exp++;if(it.st==='r')l.r++;else if(it.st==='d')l.d++;else if(it.st==='x')l.x++}));
  d.lines=Object.keys(m).sort(skuSort).map(k=>m[k]).concat(man);H.refs=P.map(p=>p.ref);
  const pOk=P.every(p=>p.items.every(i=>i.st)),mOk=!man.length||!!H.mcounted;H.counted=(P.length>0||man.length>0)&&pOk&&mOk;
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
  return {parcels:P.length,exp:it.length,r:c('r'),d:c('d'),x:c('x'),m:c('m'),pending:it.filter(i=>!i.st).length,extra:0,got:c('r')+c('d')+c('x')};
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
  if(draft||H.sheet)h+='<details class="dd" style="margin-bottom:14px"'+(H.sheet?' open':'')+'><summary><b>شيت شركة الشحن</b><span class="muted" style="font-size:12px">اختياري</span></summary><div style="padding:0 12px 12px">'+rtnSheetCard(d,draft)+'</div></details>';
  if(P.length||!draft){
    h+='<div class="strip" style="margin-bottom:14px">'+[si('بوالص',N(st.parcels),''),si('متوقع',N(st.exp),'قطعة'),si('استلمنا',N(st.got),'قطعة · سليم '+st.r+' · نضافة '+st.d+' · هالك '+st.x,'good'),si('ناقص',N(st.m),'قطعة',st.m?'crit':'good')].concat(draft?[si('لسه ما اتعدش',N(st.pending),'قطعة',st.pending?'warn':'')]:[]).join('')+'</div>';
    const diff=P.map(p=>{const m=p.items.filter(i=>i.st==='m'),e=0;return m.length?{p,m}:null}).filter(Boolean);
    if(st.m){h+='<div class="msg warn" style="margin-bottom:14px"><b>فيه فرق بين اللي اتشحن واللي استلمناه:</b><ul style="margin:6px 0 0;padding-inline-start:18px">'+diff.map(x=>'<li>أوردر <b class="mono">'+esc(x.p.ref)+'</b> (بوليصة '+esc(x.p.wb)+'): ناقص '+x.m.map(i=>esc(skuName(i.sku))).join('، ')+'</li>').join('')+'</ul><div style="margin-top:6px;font-size:12.5px">الناقص بيتسجّل <b>مفقود</b> ومربوط بالقناة والأوردر.</div></div>'}
    if(draft&&st.pending)h+='<div class="row" style="margin-bottom:12px"><button class="btn" data-a="rtnallall">كل اللي لسه ما اتعدّش: سليم ('+st.pending+')</button></div>';
  }
  h+=P.map(p=>{const o=orderByRef(p.ref),pend=p.items.filter(i=>!i.st).length,mis=p.items.filter(i=>i.st==='m').length,got=p.items.filter(i=>'rdx'.indexOf(i.st)>=0&&i.st).length;
    const pill_=pend?pill('','لسه ما اتعدّش'):mis?pill('crit','ناقص '+mis+' من '+p.items.length):pill('good','مطابق ✓');
    return '<section class="card rpc"><div class="row sp" style="margin-bottom:8px"><span><b class="mono">'+esc(p.wb)+'</b> <span class="muted">· أوردر</span> <span class="mono">'+esc(p.ref)+'</span>'+(o&&o.gov?' <span class="muted">· '+esc(o.gov)+'</span>':'')+(o?' <span class="muted">· '+EGP(ordVal(o))+'</span>':'')+'</span><span class="row" style="gap:8px">'+pill_+(draft?'<button class="btn sm ghost" data-a="rtnrm" data-p="'+p.id+'" aria-label="شيل البوليصة">✕</button>':'')+'</span></div>'
     +'<div class="rpl">'+p.items.map((it,i)=>'<div class="rpi"><span class="rpn">'+thumb(SKU.get(it.sku).m,26)+' '+sw(SKU.get(it.sku).c)+' '+esc(skuName(it.sku))+'</span><span class="seg rps" role="group" aria-label="حالة القطعة">'+RT_ST.map(s=>'<button aria-pressed="'+(it.st===s[0])+'" data-a="rtnst" data-p="'+p.id+'" data-i="'+i+'" data-v="'+s[0]+'" class="rs-'+s[0]+'"'+dis+'>'+s[1]+'</button>').join('')+'</span></div>').join('')+'</div>'
     +(draft&&pend?'<div style="margin-top:8px"><button class="btn sm" data-a="rtnall" data-p="'+p.id+'">كله سليم</button></div>':'')+'</section>'}).join('');
  h+=rtnManual(d,draft);
  return h;
}
function rtnFix(l){
  const e=num(l.exp);
  if(!l.mv){const fresh=l.r===''&&l.d===''&&l.x==='';l.d=num(l.d);l.x=num(l.x);l.m=fresh?0:Math.max(0,e-num(l.r)-l.d-l.x);l.mv=1}
  l.d=num(l.d);l.x=num(l.x);l.m=num(l.m);
  let over=l.d+l.x+l.m-e;if(over>0){const t=Math.min(l.m,over);l.m-=t;over-=t;const u=Math.min(l.x,over);l.x-=u;over-=u;l.d=Math.max(0,l.d-over)}
  l.r=Math.max(0,e-l.d-l.x-l.m);
}
function rtnManual(d,draft){
  const H=d.hdr,ro=!draft;d.lines.forEach(l=>{if(!l.par&&draft)rtnFix(l)});
  const rows=d.lines.map((l,i)=>[l,i]).filter(x=>!x[0].par);
  if(ro&&!rows.length)return '';
  let h='<section class="card"><h2>جرد يدوي <span class="hint">من غير بوليصة</span></h2>';
  if(draft)h+='<p class="muted" style="margin:0 0 10px;font-size:12.5px">اختار الصنف وكمية المتوقع. السليم بيتحسب لوحده، فاكتب بس اللي <b>مش سليم</b>: هالك نظافة، هالك نهائي، أو ناقص (ما رجعش). لو رجع أكتر من المتوقع زوّد المتوقع.</p>'+picker(d)+'<div style="height:12px"></div>';
  if(rows.length){
    const inp=(l,i,f)=>'<td class="num"><input type="number" min="0" max="'+num(l.exp)+'" value="'+(l[f]||'')+'" placeholder="0" data-c="rtnln" data-i="'+i+'" data-f="'+f+'" aria-label="'+({d:'هالك نظافة',x:'هالك نهائي',m:'ناقص'})[f]+'" '+(ro?'disabled':'')+'></td>';
    h+='<div class="tw"><table class="t-sm"><thead><tr><th>الصنف</th><th class="num">متوقع</th><th class="num">هالك نظافة</th><th class="num">هالك نهائي</th><th class="num">ناقص</th><th class="num">سليم</th><th></th></tr></thead><tbody>'
     +rows.map(([l,i])=>'<tr><td>'+esc(skuName(l.sku))+'</td><td class="num">'+N(l.exp)+'</td>'+inp(l,i,'d')+inp(l,i,'x')+inp(l,i,'m')+'<td class="num">'+pill('good',N(num(l.r)))+'</td><td>'+(ro?'':'<button class="btn sm ghost danger" data-a="rmline" data-i="'+i+'" aria-label="حذف">حذف</button>')+'</td></tr>').join('')+'</tbody></table></div>'
     +(draft?'<label class="row" style="margin-top:10px;gap:8px"><input type="checkbox" data-c="rtnmc" '+(H.mcounted?'checked':'')+'> خلّصت عدّ الأصناف اليدوية</label>':'');
  }else if(draft)h+='<div class="empty" style="padding:10px">لسه مفيش أصناف يدوية.</div>';
  return h+'</section>';
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
  rtnsheetadd:()=>{const d=curDoc(),H=d.hdr;if(!d||d.status!=='draft'||!H.sheet)return;const codes=[];H.sheet.rows.forEach(r=>{const m=rtnMatch(d,r);if(m.k==='ok')codes.push(m.o.ref)});const n=rtnAddCodes(d,codes);if(n){d.log.push(logE('اتضافت '+n+' بوليصة من شيت الشحن'));toast('اتضاف '+n+' بوليصة. عدّ القطع بقى.')}render()}
};
const CHG_RT={
  rtnln:el=>{const d=curDoc();if(!d||d.status!=='draft')return;const l=d.lines[+el.dataset.i];if(!l)return;l[el.dataset.f]=num(el.value);rtnFix(l);d.hdr.mcounted=false;rtnSync(d);dirty();clearTimeout(window.__rs);window.__rs=setTimeout(render,0)},
  rtnmc:el=>{const d=curDoc();if(!d||d.status!=='draft')return;d.hdr.mcounted=el.checked;rtnSync(d);dirty();render()}
};
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target&&e.target.id==='rtnwb'){e.preventDefault();ACT_RT.rtnadd()}});
