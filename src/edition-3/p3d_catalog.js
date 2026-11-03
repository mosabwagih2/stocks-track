
/* ---------- product catalog: add / archive SKUs at runtime ---------- */
function ensureCat(s){
  const c=s.cat||(s.cat={});
  ['skus','models','colors','sizes'].forEach(k=>{if(!c[k])c[k]=[]});
  if(!c.ext)c.ext={};if(!c.arch)c.arch={};if(!c.names)c.names={};
}
function rebuildCatalog(){
  const C=S.cat;
  SIZES.length=0;D0.sizes.forEach(z=>SIZES.push(z));C.sizes.forEach(z=>{if(SIZES.indexOf(z)<0)SIZES.push(z)});
  D.colors=D0.colors.concat(C.colors);
  const cl=m=>({code:m.code,name:m.name,colors:m.colors.slice(),sizes:m.sizes.slice()});
  const models=D0.models.map(cl).concat(C.models.map(cl));
  models.forEach(m=>{if(C.names[m.code])m.name=C.names[m.code]});
  models.forEach(m=>{const e=C.ext[m.code];if(e){(e.colors||[]).forEach(c=>{if(m.colors.indexOf(c)<0)m.colors.push(c)});(e.sizes||[]).forEach(z=>{if(m.sizes.indexOf(z)<0)m.sizes.push(z)})}});
  const all=D0.skus.concat(C.skus);
  SKU.clear();all.forEach(k=>SKU.set(k.id,k));
  D.skus=all.filter(k=>!C.arch[k.id]);
  Object.keys(IDX).forEach(k=>delete IDX[k]);D.skus.forEach(k=>IDX[k.m+'|'+k.c+'|'+k.s]=k.id);
  models.forEach(m=>{
    m.sizes.sort((a,b)=>szi(a)-szi(b));
    m.colors=m.colors.filter(c=>m.sizes.some(z=>IDX[m.code+'|'+c+'|'+z]));
    m.sizes=m.sizes.filter(z=>m.colors.some(c=>IDX[m.code+'|'+c+'|'+z]));
  });
  D.models=models;MODEL.clear();models.forEach(m=>MODEL.set(m.code,m));
  const active=new Set(D.skus.map(k=>k.m));
  const codes=models.map(m=>m.code).filter(c=>active.has(c)).sort((a,b)=>mkey(a)<mkey(b)?-1:1);
  MORDER.length=0;codes.forEach(c=>MORDER.push(c));
  Object.keys(mIdx).forEach(k=>delete mIdx[k]);MORDER.forEach((c,i)=>mIdx[c]=i);
  if(MORDER.indexOf(UI.s.m)<0)UI.s.m=MORDER[0];
  _bal=null;_ctx=null;
}
const knownColors=()=>{const a=[];D0.colors.concat(S.cat.colors).forEach(c=>{if(a.indexOf(c.ar)<0)a.push(c.ar)});D0.models.concat(S.cat.models).forEach(m=>m.colors.forEach(c=>{if(a.indexOf(c)<0)a.push(c)}));return a};
function colorCode(ar){
  const f=D0.colors.concat(S.cat.colors).find(c=>c.ar===ar);if(f)return f.code;
  let n=S.cat.colors.length+1,code='X'+n;const used=new Set(D0.colors.concat(S.cat.colors).map(c=>c.code));while(used.has(code))code='X'+(++n);
  S.cat.colors.push({code,ar});return code;
}
function skuAddInit(m,only){return {kind:'skuadd',only:!!only,m:m||MORDER[0]||'__new',newCode:'',newName:'',colors:[],sizes:[],cc:[],cs:[],newColor:'',newSize:'',min:'',err:''}}
function skuCombos(s){
  const out=[];if(!s.colors.length||!s.sizes.length)return {all:out,fresh:0,exist:0,rest:0};
  let fresh=0,exist=0,rest=0;
  s.colors.forEach(c=>s.sizes.forEach(z=>{
    const m=s.m==='__new'?String(s.newCode).trim().toUpperCase():s.m,id=m+'-'+(D0.colors.concat(S.cat.colors).find(x=>x.ar===c)||{code:'?'}).code+'-'+z;
    const has=IDX[m+'|'+c+'|'+z];
    if(has)exist++;else if(SKU.has(id)&&S.cat.arch[id])rest++;else fresh++;
    out.push({m,c,z,has});
  }));
  return {all:out,fresh,exist,rest};
}
function skuAddSheet(s){
  const isNew=s.m==='__new',cols=knownColors().concat(s.cc.filter(c=>knownColors().indexOf(c)<0)),szs=SIZES.concat(s.cs.filter(z=>SIZES.indexOf(z)<0));
  let body=s.only?'':'<label class="f">الموديل<select data-c="skum">'+MORDER.map(c=>'<option value="'+c+'" '+(s.m===c?'selected':'')+'>'+c+' · '+esc(MODEL.get(c).name)+'</option>').join('')+'<option value="__new" '+(isNew?'selected':'')+'>+ موديل جديد</option></select></label>';
  if(isNew)body+='<div class="grid g2"><label class="f">كود الموديل<input value="'+esc(s.newCode)+'" data-c="skuf" data-f="newCode" placeholder="مثلًا PAN6" style="direction:ltr;text-align:start"></label><label class="f">النوع / الاسم<input value="'+esc(s.newName)+'" data-c="skuf" data-f="newName" list="mnames" placeholder="بانتي"></label></div><datalist id="mnames">'+[...new Set(D0.models.map(m=>m.name))].map(n=>'<option value="'+esc(n)+'">').join('')+'</datalist>';
  body+='<div><div class="muted" style="font-size:12px;margin-bottom:6px;font-weight:500">الألوان</div><div class="chips">'+cols.map(c=>'<button type="button" class="chip" aria-pressed="'+(s.colors.indexOf(c)>=0)+'" data-a="skuc" data-v="'+esc(c)+'">'+sw(c)+' '+esc(c)+'</button>').join('')+'</div><div class="row" style="margin-top:8px"><input id="nc" placeholder="لون جديد" value="'+esc(s.newColor)+'" data-c="skuf" data-f="newColor" style="max-width:180px"><button type="button" class="btn sm" data-a="skuaddc">+ أضف اللون</button></div></div>';
  body+='<div><div class="muted" style="font-size:12px;margin-bottom:6px;font-weight:500">المقاسات</div><div class="chips">'+szs.map(z=>'<button type="button" class="chip" aria-pressed="'+(s.sizes.indexOf(z)>=0)+'" data-a="skus" data-v="'+esc(z)+'">'+esc(z)+'</button>').join('')+'</div><div class="row" style="margin-top:8px"><input id="ns" placeholder="مقاس جديد (مثلًا 5XL)" value="'+esc(s.newSize)+'" data-c="skuf" data-f="newSize" style="max-width:180px;direction:ltr"><button type="button" class="btn sm" data-a="skuaddz">+ أضف المقاس</button></div></div>';
  body+='<label class="f">حد أدنى للتنبيه (اختياري)<input type="number" min="0" inputmode="numeric" value="'+esc(s.min)+'" data-c="skuf" data-f="min" style="width:100%;text-align:start"></label>';
  const cb=skuCombos(s);
  body+='<div class="msg '+(cb.fresh?'':'warn')+'">'+(!s.colors.length||!s.sizes.length?'اختار لون ومقاس على الأقل.':'هيتضاف <b>'+cb.fresh+'</b> صنف جديد'+(cb.rest?' (و'+cb.rest+' هيترجّعوا من المؤرشفة)':'')+(cb.exist?' · '+cb.exist+' موجودين بالفعل وهيتخطّوا':'')+'.')+'</div>';
  if(s.err)body+='<div class="msg crit">'+esc(s.err)+'</div>';
  body+='<button class="btn pri" data-a="skusave" '+((cb.fresh+cb.rest)?'':'disabled')+'>إضافة '+(cb.fresh+cb.rest)+' صنف</button><p class="muted" style="font-size:12px">الصنف بيتضاف برصيد صفر. سجّل الرصيد من "العمليات ← استلام توريد".</p>';
  return {title:s.only?'موديل جديد':'إضافة صنف',body};
}
function skuRemoveBlock(s){
  const dm=ctx().demand[s.sku]||0,tt=total(s.sku),k=SKU.get(s.sku);
  let h='<div class="card flat" style="margin-top:6px"><h2 style="font-size:15px">إزالة الصنف</h2>';
  if(tt||dm)h+='<div class="msg warn">مينفعش تشيل الصنف ده دلوقتي: '+(tt?'فيه رصيد <b>'+fmt(tt)+'</b> قطعة':'')+(tt&&dm?' و':'')+(dm?'عليه طلب مفتوح <b>'+fmt(dm)+'</b>':'')+'. صفّر الرصيد (بجرد أو شطب) وخلّص أو الغي الأوردرات الأول.</div>';
  else h+=s.rm?'<div class="msg crit">هتشيل <b>'+esc(skuName(s.sku))+'</b> من القوائم والمصفوفة. الحركات القديمة بتفضل في السجل وتقدر ترجّعه من "كل الأصناف ← مؤرشف". متأكد؟<div class="row" style="margin-top:8px"><button class="btn danger sm" data-a="skuarch2">أيوه، شيله</button><button class="btn sm" data-a="skuarch">لأ</button></div></div>':'<p class="muted" style="margin-bottom:10px">بيخفيه من المخزون والاختيار في العمليات. الرصيد صفر وملوش طلب.</p><button class="btn danger sm" data-a="skuarch">إزالة الصنف</button>';
  return h+'</div>';
}

function modelBlockers(code){
  const act=D.skus.filter(k=>k.m===code),st=[],dem=ctx().demand;let tot=0,dm=0;
  act.forEach(k=>{const q=total(k.id),d=dem[k.id]||0;tot+=q;dm+=d;if(q||d)st.push({id:k.id,q,d})});
  return {n:act.length,tot,dm,list:st};
}
function modelRmSheet(s){
  const m=MODEL.get(s.m);if(!m)return {title:'',body:''};
  const b=modelBlockers(s.m);
  let body='<div class="row" style="gap:14px;flex-wrap:nowrap">'+thumb(s.m,64)+'<div><b>'+esc(mName(s.m))+'</b><div class="muted">'+b.n+' صنف (لون × مقاس) شغّال</div></div></div>';
  if(b.tot||b.dm){
    body+='<div class="msg warn"><b>مينفعش تشيل الموديل ده دلوقتي.</b> فيه '+(b.tot?'رصيد <b>'+fmt(b.tot)+'</b> قطعة':'')+(b.tot&&b.dm?' و':'')+(b.dm?'طلب مفتوح <b>'+fmt(b.dm)+'</b> قطعة':'')+'. صفّر الرصيد (بجرد أو شطب أو تسليم للمصنع) وخلّص أو الغي الأوردرات المفتوحة الأول.</div>';
    body+='<div class="tw"><table class="t-sm"><thead><tr><th>الصنف</th><th class="num">رصيد</th><th class="num">طلب مفتوح</th></tr></thead><tbody>'+b.list.slice(0,12).map(x=>'<tr data-a="sku" data-sku="'+x.id+'"><td>'+sw(SKU.get(x.id).c)+' '+esc(skuName(x.id,false))+'</td><td class="num">'+N(x.q)+'</td><td class="num">'+N(x.d)+'</td></tr>').join('')+'</tbody></table></div>'+(b.list.length>12?'<p class="muted" style="font-size:12px">وغيرهم '+(b.list.length-12)+' صنف.</p>':'');
  }else{
    body+=s.rm?'<div class="msg crit">هتشيل الموديل <b>'+esc(s.m)+'</b> بكل أصنافه ('+b.n+') من المخزون والمصفوفة وقوايم الاختيار. الحركات القديمة بتفضل في السجل، وتقدر ترجّعه من "كل الأصناف ← مؤرشف". متأكد؟<div class="row" style="margin-top:8px"><button class="btn danger sm" data-a="modelarch2">أيوه، شيل الموديل</button><button class="btn sm" data-a="modelarch">لأ</button></div></div>':'<p class="muted">رصيده صفر وملوش طلب مفتوح، فتقدر تشيله. بيتخبّى من المخزون والاختيار في العمليات، ومش بيتمسح من السجل.</p><button class="btn danger" data-a="modelarch">إزالة الموديل '+esc(s.m)+'</button>';
  }
  return {title:'إزالة موديل',body};
}

/* ---------- catalog editor (the single "تعديل" button) ---------- */
function catEditInit(m){
  m=(m&&MODEL.has(m)&&MORDER.indexOf(m)>=0)?m:(MORDER[0]||'');const mm=MODEL.get(m),w={};
  mm.colors.forEach(c=>mm.sizes.forEach(z=>{if(IDX[m+'|'+c+'|'+z])w[c+'|'+z]=true}));
  return {kind:'catedit',m,w,nc:[],ns:[],name:mm.name,newC:'',newS:'',err:''};
}
function catCells(s){
  const mm=MODEL.get(s.m),colors=mm.colors.concat(s.nc.filter(c=>mm.colors.indexOf(c)<0)),sizes=mm.sizes.concat(s.ns.filter(z=>mm.sizes.indexOf(z)<0)).sort((a,b)=>szi(a)-szi(b));
  return {colors,sizes};
}
function catDiff(s){
  const {colors,sizes}=catCells(s);let add=0,rm=0,lock=0;
  colors.forEach(c=>sizes.forEach(z=>{const id=IDX[s.m+'|'+c+'|'+z],want=!!s.w[c+'|'+z];
    if(id){const busy=total(id)||(ctx().demand[id]||0);if(!want&&!busy)rm++;if(busy)lock++}else if(want)add++}));
  return {add,rm,lock,name:String(s.name).trim()!==MODEL.get(s.m).name};
}
function catSum(d){return (d.add||d.rm||d.name)?('التعديلات: '+(d.add?'<b>+'+d.add+'</b> صنف جديد · ':'')+(d.rm?'<b>-'+d.rm+'</b> صنف هيتشال · ':'')+(d.name?'تغيير الاسم · ':'')).replace(/ · $/,''):'لسه مفيش تعديلات.'}
function catSumUpdate(s){const d=catDiff(s),e=$('#catsum'),b=$('[data-a=catsave]');if(e)e.innerHTML=catSum(d);if(b)b.disabled=!(d.add||d.rm||d.name)}
function catEditSheet(s){
  const mm=MODEL.get(s.m);if(!mm)return {title:'تعديل',body:'<div class="empty">مفيش موديلات.</div>'};
  const {colors,sizes}=catCells(s),d=catDiff(s);
  let body='<label class="f">الموديل<select data-c="catm">'+MORDER.map(c=>'<option value="'+c+'" '+(c===s.m?'selected':'')+'>'+c+' · '+esc(MODEL.get(c).name)+'</option>').join('')+'</select></label>';
  body+='<label class="f">النوع / الاسم<input value="'+esc(s.name)+'" data-c="catf" data-f="name"></label>';
  body+='<div><div class="muted" style="font-size:12px;margin-bottom:6px;font-weight:500">الأصناف (لون × مقاس). اضغط الخانة تضيف أو تشيل.</div><div class="tw" style="padding:8px"><table class="mx"><thead><tr><th></th>'+sizes.map(z=>'<th>'+esc(z)+'</th>').join('')+'</tr></thead><tbody>'+colors.map(c=>'<tr><td class="cl">'+sw(c)+' '+esc(c)+'</td>'+sizes.map(z=>{
    const id=IDX[s.m+'|'+c+'|'+z],on=!!s.w[c+'|'+z],busy=id?(total(id)||(ctx().demand[id]||0)):0;
    if(busy)return '<td><span class="cell tg lock" data-tip="مينفعش يتشال: رصيد '+total(id)+' · طلب '+(ctx().demand[id]||0)+'">'+fmt(total(id))+'<small>محجوز</small></span></td>';
    return '<td><button type="button" class="cell tg '+(on?(id?'on':'new'):(id?'del':'off'))+'" data-a="catcell" data-k="'+esc(c+'|'+z)+'" aria-pressed="'+on+'" aria-label="'+esc(c+' '+z)+'">'+(on?(id?'✓':'+'):(id?'−':''))+'<small>'+(on?(id?'موجود':'جديد'):(id?'هيتشال':''))+'</small></button></td>'}).join('')+'</tr>').join('')+'</tbody></table></div></div>';
  body+='<div class="grid g2"><div><div class="row"><input id="catnc" list="catcl" placeholder="لون جديد" value="'+esc(s.newC)+'" data-c="catf" data-f="newC" style="max-width:150px"><button type="button" class="btn sm" data-a="cataddc">+ لون</button></div><datalist id="catcl">'+knownColors().filter(c=>colors.indexOf(c)<0).map(c=>'<option value="'+esc(c)+'">').join('')+'</datalist></div><div><div class="row"><input id="catns" list="catsl" placeholder="مقاس جديد" value="'+esc(s.newS)+'" data-c="catf" data-f="newS" style="max-width:130px;direction:ltr"><button type="button" class="btn sm" data-a="cataddz">+ مقاس</button></div><datalist id="catsl">'+SIZES.filter(z=>sizes.indexOf(z)<0).map(z=>'<option value="'+esc(z)+'">').join('')+'</datalist></div></div>';
  body+='<div class="legend"><span><i class="dot" style="background:var(--good)"></i>موجود</span><span><i class="dot" style="background:var(--accent)"></i>جديد</span><span><i class="dot" style="background:var(--crit)"></i>هيتشال</span><span>محجوز = عليه رصيد أو طلب</span></div>';
  body+='<div class="msg" id="catsum">'+catSum(d)+'</div>';
  if(s.err)body+='<div class="msg crit">'+esc(s.err)+'</div>';
  body+='<div class="row"><button class="btn pri" data-a="catsave" '+((d.add||d.rm||d.name)?'':'disabled')+'>حفظ التعديلات</button><button class="btn danger" data-a="catrm">إزالة الموديل بالكامل</button></div>';
  return {title:'تعديل المخزون',body};
}
