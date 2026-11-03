
/* ---------- SUPPLIES: catalog, movements, auto-consumption ---------- */
const SUP_UNITS=['قطعة','كاسة','لفة','كيس','علبة'];
function defaultSupItems(st){
  return [
    {id:'FLY',name:'فلاير الشحن',unit:'قطعة',pack:1,packName:'',min:300,note:'عليه البوليصة',arch:false,auto:{kind:'order',qty:st.flyPer||1}},
    {id:'PKS',name:'تغليف فيميني S',unit:'قطعة',pack:1,packName:'',min:100,note:'',arch:false,auto:{kind:'range',qty:1,from:1,to:st.packS||2}},
    {id:'PKM',name:'تغليف فيميني M',unit:'قطعة',pack:1,packName:'',min:100,note:'',arch:false,auto:{kind:'range',qty:1,from:(st.packS||2)+1,to:st.packM||5}},
    {id:'PKL',name:'تغليف فيميني L',unit:'قطعة',pack:1,packName:'',min:100,note:'',arch:false,auto:{kind:'range',qty:1,from:(st.packM||5)+1,to:0}},
    {id:'CUP',name:'كاسات البرا',unit:'كاسة',pack:24,packName:'كيس',min:200,note:'',arch:false,auto:{kind:'pieces',qty:st.cupBR1||2,model:'BR1'}}
  ];
}
function ensureSup(s){
  const sp=s.sup||(s.sup={log:[]});
  if(!sp.items)sp.items=defaultSupItems(s.st||{});
  sp.eid=sp.eid||0;
  sp.log.forEach(e=>{
    if(!e.id)e.id=++sp.eid;
    if(!e.kind)e.kind=e.doc?(/عكس/.test(e.doc)?'rev':'auto'):(/افتتاحي/.test(e.why||'')?'open':(e.q>0?'rcv':'count'));
  });
  sp.eid=Math.max(sp.eid,...sp.log.map(e=>e.id),0);
}
const supItem=id=>S.sup.items.find(i=>i.id===id);
const supName=id=>{const i=supItem(id);return i?i.name:id};
const supBal=id=>S.sup.log.reduce((a,e)=>a+(e.item===id?e.q:0),0);
function supPush(item,q,kind,why,doc,date,extra){
  const e=Object.assign({id:++S.sup.eid,t:Date.now(),date:date||S.date,item,q,kind,why,doc:doc||null,by:S.actor},extra||{});
  S.sup.log.push(e);dirty();return e;
}
function supUse(id,days){
  days=days||7;const to=S.date,from=addDays(to,-(days-1));let u=0;
  S.sup.log.forEach(e=>{if(e.item!==id||e.date<from||e.date>to)return;
    if(e.kind==='auto'||e.kind==='issue'||(e.kind==='rev'&&(e.ofKind==='auto'||e.ofKind==='issue')))u-=e.q});
  return Math.max(0,u)/days;
}
const supCover=id=>{const u=supUse(id);return u>0?supBal(id)/u:null};
function supStatus(it){const b=supBal(it.id),c=supCover(it.id);return b<=0?'crit':((it.min&&b<it.min)||(c!=null&&c<7))?'warn':'good'}
function consumption(o){
  const out=[],n=o.lines.length;
  S.sup.items.forEach(it=>{
    if(it.arch||!it.auto||it.auto.kind==='none')return;const a=it.auto;let q=0;
    if(a.kind==='order')q=a.qty;
    else if(a.kind==='pieces')q=a.qty*o.lines.filter(s=>!a.model||SKU.get(s).m===a.model).length;
    else if(a.kind==='range'){if(n>=a.from&&(!a.to||n<=a.to))q=a.qty}
    if(q>0)out.push([it.id,-q]);
  });
  return out;
}
function ruleText(it){
  const a=it.auto||{kind:'none'};
  if(a.kind==='order')return a.qty+' لكل أوردر';
  if(a.kind==='pieces')return a.qty+' لكل قطعة '+(a.model?a.model:'(أي موديل)');
  if(a.kind==='range')return 'أوردر '+(a.to?(a.from===a.to?'من '+a.from+' قطعة':'من '+a.from+' لـ '+a.to+' قطع'):a.from+' قطع أو أكتر')+': '+a.qty+' لكل أوردر';
  return 'يدوي (مفيش خصم تلقائي)';
}
function packText(it,b){
  if(!(it.pack>1))return '';
  const p=Math.floor(Math.abs(b)/it.pack),r=Math.abs(b)%it.pack;
  return (b<0?'-':'')+p+' '+(it.packName||'عبوة')+(r?' و '+r+' '+it.unit:'');
}
function supUndo(id){
  const e=S.sup.log.find(x=>x.id===id);if(!e||e.rev||['rcv','issue','count','open'].indexOf(e.kind)<0)return false;
  supPush(e.item,-e.q,'rev','تراجع عن: '+e.why,null,S.date,{of:e.id,ofKind:e.kind});e.rev=true;dirty();return true;
}
const KIND_L={open:'رصيد افتتاحي',rcv:'استلام',issue:'صرف / شطب',count:'جرد',auto:'تلقائي من سكان',rev:'تراجع'};
const KIND_P={open:'',rcv:'good',issue:'warn',count:'info',auto:'',rev:'lost'};

/* ---------- supplies screen ---------- */
function vSupplies(){
  const items=S.sup.items.filter(i=>UI.supArch?i.arch:!i.arch),nArch=S.sup.items.filter(i=>i.arch).length;
  const tools=(nArch||UI.supArch?'<button class="btn" data-a="suparchview">'+(UI.supArch?'← رجوع للمستلزمات':'المؤرشفة ('+nArch+')')+'</button>':'')+'<button class="btn pri" data-a="supnew">+ إضافة مستلزم</button>';
  let h=top(UI.supArch?'المستلزمات المؤرشفة':'المستلزمات','عبوات وفلايرز وكاسات. بتتخصم لوحدها مع كل أوردر بيتشحن حسب قاعدة كل مستلزم.',tools);
  if(!items.length)h+='<div class="card"><div class="empty">'+(UI.supArch?'مفيش مستلزمات مؤرشفة.':'لسه مفيش مستلزمات. اضغط "إضافة مستلزم".')+'</div></div>';
  h+='<div class="grid g3">'+items.map(it=>{
    const b=supBal(it.id),u=supUse(it.id),c=supCover(it.id),k=supStatus(it),pt=packText(it,b);
    const cv=c==null?0:Math.min(100,c/30*100);
    return '<section class="card" style="'+(it.arch?'opacity:.7':'')+'"><div class="row sp"><h2 style="margin:0">'+esc(it.name)+'</h2>'+(it.arch?pill('','مؤرشف'):pill(k,k==='crit'?(b<0?'بالسالب':'خلص'):k==='warn'?'قرب يخلص':'تمام'))+'</div>'+
     '<div style="margin:12px 0 2px"><b class="n" style="font:600 32px/1.1 var(--f-mono);color:var(--'+(k==='good'?'ink':k)+')">'+fmt(b)+'</b> <span class="muted">'+esc(it.unit)+'</span></div>'+
     '<div class="muted" style="font-size:12px;min-height:18px">'+(pt?'= '+esc(pt):'')+'</div>'+
     '<div class="cbar" aria-hidden="true" style="margin:10px 0 6px"><i style="width:'+cv+'%;background:var(--'+(k==='good'?'c-ready':k==='warn'?'c-dirty':'c-scrap')+')"></i></div>'+
     '<div class="muted" style="font-size:12px">'+(c!=null?'يكفي <b class="n">'+Math.floor(c)+'</b> يوم · بيتصرف <span class="n">'+u.toFixed(1)+'</span> / يوم':'لسه مفيش استهلاك مسجّل')+(it.min?' · حد التنبيه <span class="n">'+fmt(it.min)+'</span>':'')+'</div>'+
     '<div style="margin:10px 0"><span class="pill" data-tip="قاعدة الخصم التلقائي">'+esc(ruleText(it))+'</span></div>'+
     '<div class="row">'+(it.arch?'<button class="btn sm" data-a="suprestore" data-id="'+it.id+'">استرجاع</button>':'<button class="btn sm pri" data-a="supopen" data-id="'+it.id+'" data-act="rcv">+ استلام</button><button class="btn sm" data-a="supopen" data-id="'+it.id+'" data-act="manage">إدارة</button>')+'</div></section>'}).join('')+'</div>';
  const lg=S.sup.log.slice(-30).reverse();
  h+='<h2 style="font-size:17px;margin:22px 0 10px">آخر الحركات</h2><div class="tw"><table class="t-sm"><thead><tr><th>التاريخ</th><th>المستلزم</th><th>النوع</th><th class="num">الكمية</th><th>السبب</th></tr></thead><tbody>'+lg.map(e=>'<tr style="'+(e.rev?'opacity:.55;text-decoration:line-through':'')+'"><td class="mono">'+esc(e.date)+'</td><td>'+esc(supName(e.item))+'</td><td>'+pill(KIND_P[e.kind]||'',KIND_L[e.kind]||e.kind)+'</td><td class="num mono" style="color:var(--'+(e.q<0?'crit':'good')+')">'+(e.q>0?'+':'')+e.q+'</td><td class="muted">'+esc(e.why)+'</td></tr>').join('')+'</tbody></table></div>';
  return h;
}

/* ---------- sheets: manage / add / edit ---------- */
function blankForm(){return {name:'',unit:'قطعة',pack:'',packName:'',min:'',note:'',kind:'none',qty:1,model:'',from:1,to:'',open:''}}
function formOf(it){const a=it.auto||{kind:'none'};return {name:it.name,unit:it.unit,pack:it.pack>1?it.pack:'',packName:it.packName||'',min:it.min||'',note:it.note||'',kind:a.kind||'none',qty:a.qty||1,model:a.model||'',from:a.from||1,to:a.to||'',open:''}}
const ff=(f,label,val,o)=>{o=o||{};return '<label class="f" style="'+(o.span?'grid-column:1/-1':'')+'">'+label+'<input '+(o.num?'type="number" min="0" inputmode="numeric" style="width:100%;text-align:start" ':'')+(o.list?'list="'+o.list+'" ':'')+'value="'+esc(val)+'" data-c="supf" data-f="'+f+'" '+(o.ph?'placeholder="'+esc(o.ph)+'"':'')+'></label>'};
function supForm(f,isNew){
  let h='<div class="grid g2">'+ff('name','الاسم',f.name,{span:true,ph:'مثلًا: فلاير الشحن'})+ff('unit','الوحدة',f.unit,{list:'supunits'})+ff('min','نبّهني لو الرصيد أقل من',f.min,{num:true})+
   ff('pack','عدد الوحدات في العبوة (اختياري)',f.pack,{num:true,ph:'مثلًا 24'})+ff('packName','اسم العبوة',f.packName,{ph:'كيس'})+ff('note','ملاحظة',f.note,{span:true})+'</div>';
  h+='<datalist id="supunits">'+SUP_UNITS.map(u=>'<option value="'+u+'">').join('')+'</datalist>';
  if(isNew)h+='<div class="grid g2" style="margin-top:12px">'+ff('open','الرصيد الحالي (اختياري)',f.open,{num:true,span:true})+'</div>';
  h+='<div class="card flat" style="margin-top:14px;background:var(--lav)"><h2 style="font-size:15px">الخصم التلقائي مع الشحن</h2><label class="f">القاعدة<select data-c="supkind"><option value="none" '+(f.kind==='none'?'selected':'')+'>يدوي: مفيش خصم تلقائي</option><option value="order" '+(f.kind==='order'?'selected':'')+'>كمية ثابتة لكل أوردر (مثلًا الفلاير)</option><option value="pieces" '+(f.kind==='pieces'?'selected':'')+'>كمية لكل قطعة في الأوردر (مثلًا الكاسات)</option><option value="range" '+(f.kind==='range'?'selected':'')+'>لكل أوردر حسب عدد القطع (مثلًا حجم التغليف)</option></select></label>';
  if(f.kind!=='none'){
    h+='<div class="grid g2" style="margin-top:10px">'+ff('qty',f.kind==='pieces'?'الكمية لكل قطعة':'الكمية لكل أوردر',f.qty,{num:true});
    if(f.kind==='pieces')h+='<label class="f">الموديل<select data-c="supf" data-f="model"><option value="">أي موديل</option>'+MORDER.map(m=>'<option value="'+m+'" '+(f.model===m?'selected':'')+'>'+m+' · '+esc(MODEL.get(m).name)+'</option>').join('')+'</select></label>';
    if(f.kind==='range')h+=ff('from','من عدد قطع',f.from,{num:true})+ff('to','لحد عدد قطع (فاضي = بدون حد)',f.to,{num:true,span:true});
    h+='</div>';
  }
  return h+'</div>';
}
function formErr(f){
  if(!String(f.name).trim())return 'اكتب اسم المستلزم';
  if(!String(f.unit).trim())return 'اكتب الوحدة';
  if(f.kind!=='none'&&!(+f.qty>0))return 'الكمية في قاعدة الخصم لازم تكون أكبر من صفر';
  if(f.kind==='range'){if(!(+f.from>=1))return '"من عدد قطع" لازم يكون 1 أو أكتر';if(+f.to&&+f.to<+f.from)return '"لحد" لازم يكون أكبر من أو يساوي "من"'}
  return '';
}
function formToItem(f,base){
  const auto=f.kind==='none'?{kind:'none'}:f.kind==='order'?{kind:'order',qty:+f.qty}:f.kind==='pieces'?{kind:'pieces',qty:+f.qty,model:f.model||''}:{kind:'range',qty:+f.qty,from:Math.floor(+f.from),to:Math.floor(+f.to)||0};
  return Object.assign(base||{},{name:String(f.name).trim(),unit:String(f.unit).trim(),pack:Math.floor(+f.pack)>1?Math.floor(+f.pack):1,packName:String(f.packName||'').trim(),min:Math.floor(+f.min)||0,note:String(f.note||'').trim(),auto});
}
function supMove(s){
  const it=supItem(s.id),b=supBal(s.id),k=(s.mode==='pack'&&it.pack>1)?it.pack:1,raw=s.qty===''?NaN:Math.floor(+s.qty),q=isNaN(raw)?0:raw*k;
  let delta=0,ok=false,err='';
  if(s.act==='rcv'){delta=q;ok=q>0}
  else if(s.act==='issue'){delta=-q;ok=q>0&&q<=b;if(q>b)err='مينفعش تصرف '+fmt(q)+' والرصيد '+fmt(b)}
  else{delta=isNaN(raw)?0:q-b;ok=!isNaN(raw)&&q>=0&&delta!==0}
  return {it,b,q,delta,ok,err,after:b+delta,counted:q};
}
function supPreviewHTML(s){
  const m=supMove(s);if(s.qty==='')return '<div class="muted">اكتب الكمية عشان تشوف الأثر.</div>';
  return '<div class="msg '+(m.err?'crit':'')+'">الرصيد دلوقتي <b class="n">'+fmt(m.b)+'</b> · هيبقى <b class="n">'+fmt(m.after)+'</b> '+(m.delta?'<span class="n" style="color:var(--'+(m.delta<0?'crit':'good')+')">('+(m.delta>0?'+':'')+fmt(m.delta)+')</span>':'')+(m.err?'<div>'+esc(m.err)+'</div>':'')+(s.act==='count'&&!m.delta&&s.qty!==''?'<div>العدد مطابق للرصيد، مفيش تغيير.</div>':'')+'</div>';
}
function supSheet(s){
  if(s.kind==='supnew')return {title:'إضافة مستلزم',body:supForm(s.f,true)+(s.err?'<div class="msg crit">'+esc(s.err)+'</div>':'')+'<button class="btn pri" data-a="supsave">إضافة المستلزم</button>'};
  const it=supItem(s.id);if(!it)return {title:'',body:''};
  const b=supBal(it.id);
  let body='<div class="row sp"><div><div class="muted">الرصيد الحالي</div><b class="n" style="font:600 28px var(--f-mono)">'+fmt(b)+'</b> <span class="muted">'+esc(it.unit)+'</span>'+(packText(it,b)?'<div class="muted" style="font-size:12px">= '+esc(packText(it,b))+'</div>':'')+'</div><span class="pill">'+esc(ruleText(it))+'</span></div>';
  if(s.tab==='edit')body+='<div class="row sp"><button class="btn sm ghost" data-a="suptab" data-v="move">← رجوع للحركات</button><b>إعدادات المستلزم</b></div>';
  else body+='<div class="row sp" style="gap:6px"><div class="tabs" role="tablist" style="margin:0;border:0">'+[['move','حركة'],['log','السجل']].map(t=>'<button role="tab" aria-selected="'+(s.tab===t[0])+'" data-a="suptab" data-v="'+t[0]+'">'+t[1]+'</button>').join('')+'</div><button class="btn sm" data-a="supedit" data-tip="الاسم والوحدة والعبوة وحد التنبيه وقاعدة الخصم والأرشفة">⚙ إعدادات المستلزم</button></div><hr style="border:0;border-top:1px solid var(--line);margin:0">';
  if(s.tab==='move'){
    const m=supMove(s);
    body+='<div class="seg" role="group" aria-label="نوع الحركة">'+[['rcv','استلام (زيادة)'],['issue','صرف / شطب (نقص)'],['count','ضبط الرصيد بالجرد']].map(a=>'<button type="button" aria-pressed="'+(s.act===a[0])+'" data-a="supact" data-v="'+a[0]+'">'+a[1]+'</button>').join('')+'</div>';
    if(s.act==='count')body+='<div class="msg warn">الجرد بيستبدل الرصيد الحالي بالعدد الفعلي اللي عدّيته. استخدمه بس لو عدّيت المستلزم بإيدك.</div>';
    if(it.pack>1)body+='<div class="seg" role="group"><button type="button" aria-pressed="'+(s.mode!=='pack')+'" data-a="supmode" data-v="unit">بال'+esc(it.unit)+'</button><button type="button" aria-pressed="'+(s.mode==='pack')+'" data-a="supmode" data-v="pack">بال'+esc(it.packName||'عبوة')+' ('+it.pack+' '+esc(it.unit)+')</button></div>';
    body+='<label class="f">'+(s.act==='count'?'العدد الفعلي دلوقتي':s.act==='rcv'?'الكمية المستلمة':'الكمية اللي هتتصرف')+(it.pack>1?' ('+(s.mode==='pack'?esc(it.packName||'عبوة'):esc(it.unit))+')':' ('+esc(it.unit)+')')+'<input type="number" min="0" inputmode="numeric" id="supq" value="'+esc(s.qty)+'" data-c="supq" style="width:100%;text-align:start"></label>';
    if(s.act!=='count')body+='<label class="f">'+(s.act==='issue'?'السبب':'ملاحظة (اختياري)')+(s.act==='issue'?'<select data-c="supreason">'+['استخدام يدوي','تالف','ضايع','أخرى'].map(r=>'<option '+(s.reason===r?'selected':'')+'>'+r+'</option>').join('')+'</select>':'<input id="supnote" value="'+esc(s.note||'')+'" data-c="supnote" placeholder="مثلًا: فاتورة 123">')+'</label>';
    body+='<div id="supprev">'+supPreviewHTML(s)+'</div>';
    body+='<button class="btn pri" id="supgo" data-a="supgo" '+(m.ok?'':'disabled')+'>'+(s.act==='rcv'?'تأكيد الاستلام':s.act==='issue'?'تأكيد الصرف':'تأكيد الجرد')+'</button>';
  }else if(s.tab==='edit'){
    body+=supForm(s.f,false)+(s.err?'<div class="msg crit">'+esc(s.err)+'</div>':'')+'<button class="btn pri" data-a="supsave">حفظ التعديلات</button>';
    body+='<div class="card flat" style="margin-top:6px"><h2 style="font-size:15px">إخفاء المستلزم</h2><p class="muted" style="margin-bottom:10px">الأرشفة بتخفي المستلزم وبتوقف الخصم التلقائي. الحركات القديمة بتفضل محفوظة وتقدر ترجّعه في أي وقت.</p>'+(s.arch?'<div class="msg crit">هتأرشف "'+esc(it.name)+'" (رصيده '+fmt(b)+'). متأكد؟<div class="row" style="margin-top:8px"><button class="btn danger sm" data-a="suparch2">أيوه، أرشف</button><button class="btn sm" data-a="suparch">لأ</button></div></div>':'<button class="btn danger sm" data-a="suparch">أرشفة المستلزم</button>')+'</div>';
  }else{
    const man=e=>['open','rcv','issue','count'].indexOf(e.kind)>=0||(e.kind==='rev'&&e.ofKind!=='auto');
    const lg=S.sup.log.filter(e=>e.item===it.id&&(s.logAll||man(e))).slice(-40).reverse();
    body+='<div class="chips"><button class="chip" aria-pressed="'+(!s.logAll)+'" data-a="suplog" data-v="man">الحركات اليدوية</button><button class="chip" aria-pressed="'+(!!s.logAll)+'" data-a="suplog" data-v="all">الكل (مع الخصم التلقائي)</button></div>';
    body+=lg.length?'<div class="tw"><table class="t-sm"><tbody>'+lg.map(e=>'<tr style="'+(e.rev?'opacity:.55;text-decoration:line-through':'')+'"><td class="mono muted">'+esc(e.date)+'</td><td>'+pill(KIND_P[e.kind]||'',KIND_L[e.kind]||e.kind)+'<div class="muted" style="font-size:12px">'+esc(e.why)+'</div></td><td class="num mono" style="color:var(--'+(e.q<0?'crit':'good')+')">'+(e.q>0?'+':'')+e.q+'</td><td>'+((!e.rev&&['rcv','issue','count','open'].indexOf(e.kind)>=0)?(s.undo===e.id?'<button class="btn danger sm" data-a="supundo2" data-id="'+e.id+'">تأكيد التراجع</button>':'<button class="btn ghost sm" data-a="supundo" data-id="'+e.id+'">تراجع</button>'):'')+'</td></tr>').join('')+'</tbody></table></div><p class="muted" style="font-size:12px">التراجع بيسجّل حركة عكسية، مش بيمسح القديم. الحركات التلقائية بتتعكس لما تعكس عملية السكان.</p>':'<div class="empty">مفيش حركات.</div>';
  }
  return {title:it.name,body};
}
