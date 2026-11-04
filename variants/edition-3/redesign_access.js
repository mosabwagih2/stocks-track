/* ---------- v2: users, roles, permissions, day close ----------
   Honest scope: everything here runs in the browser, so it keeps honest people honest and builds the audit trail.
   Real enforcement needs a server (the Supabase version). */
const PERMS=[['money','يشوف الفلوس والتكلفة'],['scan','شحن بالسكان'],['returns','استلام المرتجع'],['receive','استلام من المصنع'],['internal','هالك / غسيل / مفقود'],['ship','توريد للمحل'],['count','الجرد'],['pickup','رفع بيك أب'],['cancel','إلغاء أوردر'],['reverse','عكس عملية'],['catalog','تعديل الأصناف والموديلات'],['supplies','المستلزمات'],['close','تقفيل اليوم'],['reopen','فتح يوم مقفول'],['settings','الإعدادات'],['users','المستخدمين والصلاحيات']];
const PERM_NAME=Object.fromEntries(PERMS);
const ROLE_DEFAULT={
  admin:{name:'مدير',perms:PERMS.map(p=>p[0])},
  sup:{name:'مشرف مخزن',perms:['scan','returns','receive','internal','ship','count','pickup','cancel','reverse','catalog','supplies','close']},
  pack:{name:'موظف شحن',perms:['scan','returns']},
  view:{name:'مراجعة (قراءة فقط)',perms:['money']}
};
const DOC_PERM={SCN:'scan',RTN:'returns',RCV:'receive',FRC:'internal',FSD:'internal',CLN:'internal',LOS:'internal',SHP:'ship',CNT:'count'};
const ACT_PERM={pksave:'pickup',pksave2:'pickup',pkdel:'pickup',pkdel2:'pickup',pkedit:'pickup',scansave:'scan',scsave:'scan',scedit:'scan',screv:'reverse',screv2:'reverse',cxopen:'cancel',cxgo:'cancel',uncx:'cancel',reverse:'reverse',
  reset:'settings',reset2:'settings',demoask:'settings',demoload:'settings',demoreset:'settings',
  skuadd:'catalog',catedit:'catalog',catsave:'catalog',skusave:'catalog',modelrm:'catalog',modelarch:'catalog',modelarch2:'catalog',modelrestore:'catalog',skuarch:'catalog',skuarch2:'catalog',skurestore:'catalog',skuop:'catalog',
  supsave:'supplies',supnew:'supplies',supconf:'supplies',suparch:'supplies',suparch2:'supplies',supundo:'supplies',supundo2:'supplies',undoentry:'supplies',supact:'supplies',
  usadd:'users',usdel:'users',clreopen:'reopen'};
const CLOSED_ACTS={pksave:1,pksave2:1,cxgo:1,supsave:1,supundo:1,supundo2:1,undoentry:1,supact:1};
const CHG_PERM={cost:'settings',st:'settings',actor:'settings'};
function cyrb(s){let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677)}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return (4294967296*(2097151&h2)+(h1>>>0)).toString(36)}
const pinHash=p=>cyrb('fm|'+String(p).trim());
const navList=()=>NAV.filter(n=>n[0]!=='config'||can('settings')||can('users'));
function ensureAcc(s){
  if(!s.roles){s.roles={};Object.keys(ROLE_DEFAULT).forEach(k=>s.roles[k]={name:ROLE_DEFAULT[k].name,perms:ROLE_DEFAULT[k].perms.slice()})}
  if(!s.users||!s.users.length){s.users=[{id:'u1',name:s.actor||'مصعب',role:'admin',pin:null,on:true}];s.cur='u1'}
  if(!s.audit)s.audit=[];if(!s.closes)s.closes=[];if(s.lock==null)s.lock='';
  if(!s.users.some(u=>u.id===s.cur))s.cur=s.users[0].id;
  s.actor=(s.users.find(u=>u.id===s.cur)||{}).name||s.actor;
}
const curUser=()=>(S.users||[]).find(u=>u.id===S.cur)||{role:'admin',name:S.actor};
function can(p){const u=curUser(),r=S.roles&&S.roles[u.role];return u.role==='admin'||!!(r&&r.perms.indexOf(p)>=0)}
function audit(m){S.audit.push({t:Date.now(),by:S.actor,m});if(S.audit.length>300)S.audit.splice(0,S.audit.length-300);dirty()}
function deny(p){toast('مش مسموح لدورك ('+curUser().role+'): '+(PERM_NAME[p]||p));return false}
const roleName=id=>(S.roles[id]||{name:id}).name;
const dayLocked=d=>!!S.lock&&d<=S.lock;
function gateAct(el){
  const a=el.dataset.a;let p=ACT_PERM[a];
  if(a==='go'&&el.dataset.t==='config'&&!can('settings')&&!can('users'))return deny('settings');
  if(a==='newop')p=DOC_PERM[el.dataset.t];
  if(a==='upload')p=el.dataset.t==='scan'?'scan':'pickup';
  if(a==='confirm'){const d=curDoc();p=d&&DOC_PERM[d.type]}
  if(p&&!can(p))return deny(p);
  if(CLOSED_ACTS[a]&&dayLocked(S.date)){toast('اليوم مقفول. لازم المدير يفتحه الأول');return false}
  return true;
}
/* ---------- lock screen ---------- */
function lockScreen(){
  let el=document.getElementById('lockscr');if(!el){el=document.createElement('div');el.id='lockscr';document.body.appendChild(el)}
  const sel=UI.lg&&UI.lg.id,u=S.users.find(x=>x.id===sel);
  el.innerHTML='<div class="lk"><div class="lkc"><h2>مين بيشتغل دلوقتي؟</h2><p class="muted">كل حاجة بتتسجل باسمك في السجل.</p>'
   +(u?'<div class="lkp"><b>'+esc(u.name)+'</b><span class="muted">'+esc(roleName(u.role))+'</span>'+(u.pin?'<input id="lgpin" type="password" inputmode="numeric" autocomplete="off" placeholder="الرقم السري" autofocus>':'')+(UI.lg.err?'<div class="msg crit">'+esc(UI.lg.err)+'</div>':'')+'<div class="row"><button class="btn pri" data-a="lgdo">دخول</button><button class="btn" data-a="lgpick" data-id="">رجوع</button></div></div>'
     :'<div class="lku">'+S.users.filter(x=>x.on!==false).map(x=>'<button class="lku1" data-a="lgpick" data-id="'+x.id+'"><i>'+esc(x.name.slice(0,1))+'</i><b>'+esc(x.name)+'</b><small>'+esc(roleName(x.role))+(x.pin?' · 🔒':'')+'</small></button>').join('')+'</div>')
   +'</div></div>';
  const i=document.getElementById('lgpin');if(i)i.focus();
}
function unlockApp(u){S.cur=u.id;S.actor=u.name;UI.locked=false;UI.lg=null;audit('دخول: '+u.name+' ('+roleName(u.role)+')');const el=document.getElementById('lockscr');if(el)el.remove();_L.rail=_L.main=_L.sheet=null;render()}
/* ---------- day close ---------- */
function closeSnap(date){
  const L={};INTERNAL.forEach(l=>L[l]={open:0,in:0,out:0});
  const k={ship:0,ret:{r:0,d:0,x:0,lost:0},rcv:0,shop:0,adjP:0,adjM:0,off:0,wash:0,back:0,rej:0,cxBack:0};
  S.moves.forEach(m=>{
    INTERNAL.forEach(l=>{if(m.to===l){if(m.date<date)L[l].open+=m.q;else if(m.date===date)L[l].in+=m.q}if(m.from===l){if(m.date<date)L[l].open-=m.q;else if(m.date===date)L[l].out+=m.q}});
    if(m.date!==date)return;
    if(m.type==='SCN'){if(m.to==='EXT_CH')k.ship+=m.q;else if(m.from==='EXT_CH')k.ship-=m.q}
    else if(m.type==='RTN'){if(m.to==='READY')k.ret.r+=m.q;else if(m.to==='DIRTY')k.ret.d+=m.q;else if(m.to==='SCRAP')k.ret.x+=m.q;else if(m.to==='LOST')k.ret.lost+=m.q}
    else if(m.type==='RCV')k.rcv+=m.q;else if(m.type==='SHP')k.shop+=m.q;
    else if(m.type==='CNT'){if(m.from==='EXT_ADJ')k.adjP+=m.q;else if(m.to==='EXT_ADJ')k.adjM+=m.q}
    else if(m.type==='LOS'&&m.to==='EXT_OFF')k.off+=m.q;
    else if(m.type==='FSD'&&m.to==='FACTORY')k.wash+=m.q;
    else if(m.type==='FRC'){if(m.to==='READY')k.back+=m.q;else if(m.to==='SCRAP')k.rej+=m.q}
    else if(m.type==='CXL')k.cxBack+=m.q;
  });
  INTERNAL.forEach(l=>L[l].close=L[l].open+L[l].in-L[l].out);
  const pk=S.pickups.filter(p=>p.date===date),ids=pk.map(p=>p.id),ordIn=S.orders.filter(o=>ids.indexOf(o.pk)>=0),shipped=S.orders.filter(o=>o.sc&&o.sc.date===date);
  const pkD=Object.fromEntries(S.pickups.map(p=>[p.id,p.date])),waiting=S.orders.filter(o=>o.st==='open'&&pkD[o.pk]<=date).length;
  const sup={};S.sup.items.forEach(i=>{sup[i.id]=S.sup.log.reduce((a,e)=>a+(e.item===i.id&&e.date<=date?e.q:0),0)});
  const cx=S.orders.filter(o=>o.cx&&o.cx.date===date).length,docs=S.docs.filter(d=>d.status==='done'&&d.date===date).length;
  return {date,L,k,ordIn:ordIn.length,pcsIn:ordIn.reduce((a,o)=>a+o.lines.length,0),shipO:shipped.length,shipP:shipped.reduce((a,o)=>a+o.lines.length,0),waiting,sup,cx,docs,pickups:pk.length};
}
function closeChecks(date){
  const c=[],snap=closeSnap(date),C=ctx();
  const dr=S.docs.filter(d=>d.status==='draft'&&d.date<=date).length;
  if(dr)c.push({lv:'block',t:dr+' عملية مسودة لسه ما اتأكدتش. أكّدها أو احذفها.'});
  if(date===S.date){const neg=D.skus.filter(k=>g(k.id,'READY')<0);if(neg.length)c.push({lv:'block',t:neg.length+' صنف رصيده بالسالب ('+neg.slice(0,3).map(k=>skuName(k.id)).join('، ')+'). اعمل جرد وصحّحه.'})}
  if(date>S.date)c.push({lv:'block',t:'مينفعش تقفّل يوم في المستقبل.'});
  if(snap.waiting&&date===S.date){const bl=Object.keys(C.blocked).length;if(snap.waiting-bl>0)c.push({lv:'warn',t:(snap.waiting-bl)+' أوردر لسه مستني السكان.'});if(bl)c.push({lv:'warn',t:bl+' أوردر معطل بسبب الرصيد.'})}
  const bad=S.orders.filter(o=>o.st==='open'&&o.bad&&o.bad.length).length;if(bad)c.push({lv:'warn',t:bad+' أوردر فيه كود غير مربوط.'});
  const sl=S.sup.items.filter(s=>!s.arch&&supStatus(s)!=='good');if(sl.length)c.push({lv:'warn',t:'مستلزمات قربت تخلص: '+sl.map(s=>s.name).join('، ')+'.'});
  if(!snap.docs&&!snap.shipO&&!snap.pickups)c.push({lv:'warn',t:'مفيش أي حركة في اليوم ده.'});
  return {snap,list:c,blockers:c.filter(x=>x.lv==='block').length};
}
function unlockedDays(){const out=[];for(let i=0;i<8;i++){const d=addDays(S.date,-i);if(dayLocked(d))break;out.push(d)}return out.reverse()}
function closeSheet(){
  const days=unlockedDays(),cl=UI.cl||(UI.cl={}),sel=cl.date&&days.indexOf(cl.date)>=0?cl.date:days[days.length-1];
  const last=S.closes.filter(x=>x.status==='closed').slice(-1)[0];
  let h='';
  if(!can('close'))h+='<div class="msg warn">دورك مش بيسمح بتقفيل اليوم. تقدر تشوف بس.</div>';
  if(sel){
    const ck=closeChecks(sel),s=ck.snap,sum=a=>a.reduce((x,y)=>x+y,0);
    h+='<div class="chips" style="margin-bottom:12px">'+days.map(d=>'<button class="chip" aria-pressed="'+(d===sel)+'" data-a="clpick" data-d="'+d+'">'+(d===S.date?'النهارده':d.slice(5))+'</button>').join('')+'</div>';
    if(days.length>1&&sel!==days[0])h+='<div class="msg info" style="margin-bottom:10px">تقفيل '+sel+' هيقفل كمان '+(days.indexOf(sel))+' يوم قبله.</div>';
    h+='<div class="kpis" style="margin-bottom:12px">'+kpi('اتطلب',N(s.pcsIn),s.ordIn+' أوردر')+kpi('اتشحن',N(s.shipP),s.shipO+' أوردر','good')+kpi('مرتجع داخل',N(s.k.ret.r+s.k.ret.d+s.k.ret.x+s.k.ret.lost),'سليم '+s.k.ret.r+' · نضافة '+s.k.ret.d)+kpi('مستني السكان',N(s.waiting),'في آخر اليوم',s.waiting?'warn':'')+'</div>';
    h+='<div class="gh">المراجعة</div><div class="chk" style="margin-bottom:12px">'+(ck.list.length?ck.list.map(x=>'<div class="'+(x.lv==='block'?'no':'wn')+'"><span>'+(x.lv==='block'?'<b>لازم يتحل:</b> ':'تنبيه: ')+esc(x.t)+'</span></div>').join(''):'<div class="ok"><span>مفيش ملاحظات.</span></div>')+'</div>';
    h+='<div class="gh">مطابقة الرصيد: أول اليوم + دخل − خرج = آخر اليوم</div><div class="tw" style="margin-bottom:12px"><table class="t-sm"><thead><tr><th>الحالة</th><th class="num">أول اليوم</th><th class="num">دخل</th><th class="num">خرج</th><th class="num">آخر اليوم</th></tr></thead><tbody>'+INTERNAL.map(l=>{const r=s.L[l];return '<tr><td>'+LOC[l]+'</td><td class="num">'+fmt(r.open)+'</td><td class="num">'+(r.in?'+'+fmt(r.in):'·')+'</td><td class="num">'+(r.out?'−'+fmt(r.out):'·')+'</td><td class="num"><b class="n">'+fmt(r.open+r.in-r.out)+'</b></td></tr>'}).join('')+'<tr><td><b>الإجمالي</b></td><td class="num">'+fmt(sum(INTERNAL.map(l=>s.L[l].open)))+'</td><td class="num">'+fmt(sum(INTERNAL.map(l=>s.L[l].in)))+'</td><td class="num">'+fmt(sum(INTERNAL.map(l=>s.L[l].out)))+'</td><td class="num"><b class="n">'+fmt(sum(INTERNAL.map(l=>s.L[l].open+s.L[l].in-s.L[l].out)))+'</b></td></tr></tbody></table></div>';
    h+='<label class="f">ملاحظة التقفيل (اختياري)<input data-c="clnote" value="'+esc(cl.note||'')+'" placeholder="مثلًا: عجز في BR2 احمر L اتسجل في الجرد"></label>';
    h+='<div class="row" style="margin-top:12px"><button class="btn pri" data-a="clconfirm" '+((ck.blockers||!can('close'))?'disabled':'')+'>قفّل '+(sel===S.date?'النهارده':sel)+'</button><span class="muted" style="font-size:12.5px">بعد التقفيل مفيش عملية بتتسجل في اليوم ده أو قبله إلا بعد ما المدير يفتحه.</span></div>';
  }else{
    h+='<div class="msg good">كل الأيام لحد النهارده مقفولة'+(last?' (آخر تقفيل: '+esc(last.date)+' بواسطة '+esc(last.by)+')':'')+'.</div>';
  }
  const hist=S.closes.slice().reverse().slice(0,12);
  h+='<div class="gh" style="margin-top:18px">سجل التقفيلات</div>'+(hist.length?'<div class="tw"><table class="t-sm"><thead><tr><th>اليوم</th><th>بواسطة</th><th class="num">اتشحن</th><th>الحالة</th></tr></thead><tbody>'+hist.map(x=>'<tr><td>'+esc(x.date)+'</td><td>'+esc(x.by)+' <span class="muted">· '+timeOf(x.at)+'</span></td><td class="num">'+fmt(x.snap.shipP)+'</td><td>'+(x.status==='closed'?pill('good','مقفول'):pill('warn','اتفتح: '+esc((x.reopened||{}).reason||'')))+'</td></tr>').join('')+'</tbody></table></div>':'<div class="muted">لسه مفيش تقفيلات.</div>');
  if(last&&can('reopen'))h+='<div class="msg warn" style="margin-top:14px"><b>فتح آخر يوم مقفول ('+esc(last.date)+')</b><label class="f" style="margin-top:8px">السبب (بيتسجل)<input data-c="clreason" value="'+esc(cl.reason||'')+'"></label><div style="margin-top:8px"><button class="btn danger" data-a="clreopen" '+((cl.reason||'').trim()?'':'disabled')+'>افتح اليوم</button></div></div>';
  return {title:'تقفيل اليوم',body:h};
}
function dayCloseBar(){
  if(!S.closes)return '';
  const un=unlockedDays(),past=un.filter(d=>d<S.date&&(S.pickups.some(p=>p.date===d)||S.moves.some(m=>m.date===d)));
  if(dayLocked(S.date)){const c=S.closes.filter(x=>x.status==='closed').slice(-1)[0];return '<div class="msg good row sp dcb"><span><b>اليوم مقفول</b>'+(c?' · '+esc(c.by)+' '+timeOf(c.at):'')+'. العمليات متوقفة لحد ما المدير يفتحه.</span><button class="btn sm" data-a="closeday">تفاصيل التقفيل</button></div>'}
  if(past.length)return '<div class="msg warn row sp dcb"><span>فيه <b>'+past.length+'</b> '+(past.length>1?'أيام':'يوم')+' فاتوا من غير تقفيل.</span><button class="btn sm" data-a="closeday">قفّلهم</button></div>';
  return '<div class="row sp dcb"><span class="muted" style="font-size:12.5px">'+(S.lock?'آخر تقفيل: '+esc(S.lock):'لسه مفيش تقفيل')+'</span><button class="btn sm" data-a="closeday">تقفيل اليوم</button></div>';
}
function whoSheet(){
  const u=curUser();
  return {title:'حسابي',body:'<div class="row" style="gap:12px"><span class="lku1 me"><i>'+esc(u.name.slice(0,1))+'</i></span><div><b>'+esc(u.name)+'</b><div class="muted">'+esc(roleName(u.role))+'</div></div></div>'
   +'<div class="gh" style="margin-top:14px">اللي تقدر تعمله</div><div class="chips">'+PERMS.map(p=>'<span class="pill '+(can(p[0])?'good':'')+'" style="'+(can(p[0])?'':'opacity:.5;text-decoration:line-through')+'">'+p[1]+'</span>').join('')+'</div>'
   +'<div class="gh" style="margin-top:14px">الرقم السري بتاعي</div><div class="row"><input id="mypin" type="password" inputmode="numeric" placeholder="رقم سري جديد (4 أرقام أو أكتر)" style="width:240px"><button class="btn" data-a="mypin">حفظ</button>'+(u.pin?'<button class="btn ghost" data-a="mypinoff">إلغاء الرقم السري</button>':'')+'</div>'
   +'<div style="margin-top:16px"><button class="btn pri" data-a="lockapp">قفل الشاشة / تبديل مستخدم</button></div>'};
}
function vAccess(){
  if(!can('users'))return '<section class="card"><h2>المستخدمين والصلاحيات</h2><div class="msg warn">دورك مش بيسمح بإدارة المستخدمين.</div></section>';
  const adm=S.users.filter(u=>u.role==='admin'&&u.on!==false).length;
  const ro=sel=>Object.keys(S.roles).map(r=>'<option value="'+r+'" '+(sel===r?'selected':'')+'>'+esc(S.roles[r].name)+'</option>').join('');
  let h='<section class="card"><h2>المستخدمين <span class="hint">كل حاجة بتتسجل باسم اللي دخل</span></h2><div class="tw"><table class="dt"><thead><tr><th>الاسم</th><th>الدور</th><th>رقم سري</th><th>شغّال</th><th></th></tr></thead><tbody>'
   +S.users.map(u=>'<tr><td><b>'+esc(u.name)+'</b>'+(u.id===S.cur?' <span class="pill info">أنت</span>':'')+'</td><td><select data-c="usrole" data-id="'+u.id+'">'+ro(u.role)+'</select></td><td>'+(u.pin?'<span class="pill good">متحط</span> ':'<span class="pill">مفيش</span> ')+'<input type="password" inputmode="numeric" placeholder="جديد" data-c="usrpin" data-id="'+u.id+'" style="width:90px"></td><td><input type="checkbox" data-c="usron" data-id="'+u.id+'" '+(u.on!==false?'checked':'')+'></td><td>'+(u.id===S.cur?'':'<button class="btn sm danger" data-a="usdel" data-id="'+u.id+'">حذف</button>')+'</td></tr>').join('')
   +'</tbody></table></div><div class="picker" style="margin-top:12px"><label class="f">اسم جديد<input id="nu_name"></label><label class="f">الدور<select id="nu_role">'+ro('pack')+'</select></label><label class="f">رقم سري (اختياري)<input id="nu_pin" type="password" inputmode="numeric"></label><button class="btn pri" data-a="usadd">+ إضافة مستخدم</button></div>'
   +(adm<2?'<p class="muted" style="margin-top:8px;font-size:12.5px">لازم يفضل مدير واحد شغّال على الأقل.</p>':'')+'</section>';
  const rk=Object.keys(S.roles);
  h+='<section class="card"><h2>مصفوفة الصلاحيات <span class="hint">المدير دايمًا كل حاجة</span></h2><div class="tw"><table class="t-sm"><thead><tr><th>الصلاحية</th>'+rk.map(r=>'<th class="num">'+esc(S.roles[r].name)+'</th>').join('')+'</tr></thead><tbody>'
   +PERMS.map(p=>'<tr><td>'+p[1]+'</td>'+rk.map(r=>'<td class="num"><input type="checkbox" data-c="rolep" data-r="'+r+'" data-p="'+p[0]+'" '+((r==='admin'||S.roles[r].perms.indexOf(p[0])>=0)?'checked':'')+(r==='admin'?' disabled':'')+'></td>').join('')+'</tr>').join('')+'</tbody></table></div></section>';
  h+='<section class="card"><h2>سجل النشاط <span class="hint">آخر 25</span></h2>'+(S.audit.length?'<div class="tl">'+S.audit.slice(-25).reverse().map(a=>'<div class="tli" style="grid-template-columns:minmax(0,1fr) auto"><span class="tt"><b>'+esc(a.m)+'</b><small class="muted">'+esc(a.by)+'</small></span><span class="muted" style="font-size:12px">'+timeOf(a.t)+'</span></div>').join('')+'</div>':'<div class="muted">لسه مفيش.</div>')+'</section>';
  return h;
}
function recvSheet(){
  const o=[['RCV','استلام من المصنع','قطع جديدة جت بورقة موقّعة','receive'],['FRC','استلام مغسول من المصنع','اللي اتبعت غسيل ورجع (والمرفوض بيتسجل هالك)','internal'],['RTN','استلام مرتجعات','اللي رجع من القنوات: سليم أو محتاج نضافة أو هالك','returns']];
  return {title:'استلام',body:'<div class="opgrid" style="grid-template-columns:1fr">'+o.map(x=>'<button class="op" data-a="recvgo" data-t="'+x[0]+'" '+(can(x[3])?'':'style="opacity:.55"')+'><span class="ic">'+ic(OT[x[0]].ic)+'</span><b>'+x[1]+'</b><small>'+x[2]+'</small></button>').join('')+'</div>'};
}
const ACT_ACC={
  recvmenu:()=>{UI.sheet={kind:'recv'};render()},
  recvgo:el=>{const t=el.dataset.t,p=DOC_PERM[t];if(p&&!can(p)){deny(p);return}if(dayLocked(S.date)){toast('اليوم مقفول. لازم المدير يفتحه الأول');return}UI.sheet=null;go('ops',()=>{newDoc(t)})},
  whoami:()=>{UI.sheet={kind:'who'};render()},
  lockapp:()=>{UI.sheet=null;UI.locked=true;UI.lg=null;audit('قفل الشاشة');render()},
  lgpick:el=>{UI.lg=el.dataset.id?{id:el.dataset.id}:null;lockScreen()},
  lgdo:()=>{const u=S.users.find(x=>x.id===(UI.lg||{}).id);if(!u)return;const i=document.getElementById('lgpin');if(u.pin&&(!i||pinHash(i.value)!==u.pin)){UI.lg.err='الرقم السري غلط';lockScreen();audit('محاولة دخول فاشلة: '+u.name);return}unlockApp(u)},
  closeday:()=>{UI.sheet={kind:'close'};UI.cl=UI.cl||{};render()},
  clpick:el=>{UI.cl.date=el.dataset.d;render()},
  clconfirm:()=>{
    if(!can('close'))return deny('close');const days=unlockedDays(),sel=(UI.cl&&UI.cl.date&&days.indexOf(UI.cl.date)>=0)?UI.cl.date:days[days.length-1];if(!sel)return;
    const ck=closeChecks(sel);if(ck.blockers){toast('فيه حاجات لازم تتحل الأول');return}
    S.closes.push({id:'c'+(S.closes.length+1),date:sel,at:Date.now(),by:S.actor,note:(UI.cl.note||'').trim(),snap:{shipP:ck.snap.shipP,shipO:ck.snap.shipO,pcsIn:ck.snap.pcsIn,ordIn:ck.snap.ordIn,L:ck.snap.L,k:ck.snap.k,waiting:ck.snap.waiting,sup:ck.snap.sup},status:'closed'});
    S.lock=sel;audit('تقفيل '+sel+(UI.cl.note?' · '+UI.cl.note:''));UI.cl={};dirty();toast('اتقفل '+(sel===S.date?'النهارده':sel));render()},
  clreopen:()=>{
    if(!can('reopen'))return deny('reopen');const reason=((UI.cl||{}).reason||'').trim();if(!reason)return;
    const last=S.closes.filter(x=>x.status==='closed').slice(-1)[0];if(!last)return;
    last.status='reopened';last.reopened={at:Date.now(),by:S.actor,reason};const rest=S.closes.filter(x=>x.status==='closed');S.lock=rest.length?rest[rest.length-1].date:'';
    audit('فتح يوم '+last.date+' · '+reason);UI.cl={};dirty();toast('اتفتح يوم '+last.date);render()},
  mypin:()=>{const i=document.getElementById('mypin'),v=i?i.value.trim():'';if(v.length<4){toast('الرقم السري 4 أرقام على الأقل');return}curUser().pin=pinHash(v);audit('تغيير رقم سري: '+S.actor);dirty();toast('اتحفظ');render()},
  mypinoff:()=>{curUser().pin=null;audit('إلغاء رقم سري: '+S.actor);dirty();render()},
  usadd:()=>{const n=(document.getElementById('nu_name').value||'').trim(),r=document.getElementById('nu_role').value,p=(document.getElementById('nu_pin').value||'').trim();
    if(!n){toast('اكتب الاسم');return}if(S.users.some(u=>u.name===n)){toast('الاسم متكرر');return}if(p&&p.length<4){toast('الرقم السري 4 أرقام على الأقل');return}
    S.users.push({id:'u'+(Date.now().toString(36)),name:n,role:r,pin:p?pinHash(p):null,on:true});audit('مستخدم جديد: '+n+' ('+roleName(r)+')');dirty();render()},
  usdel:el=>{const u=S.users.find(x=>x.id===el.dataset.id);if(!u||u.id===S.cur)return;if(u.role==='admin'&&S.users.filter(x=>x.role==='admin'&&x.on!==false).length<2){toast('لازم يفضل مدير واحد');return}S.users=S.users.filter(x=>x!==u);audit('حذف مستخدم: '+u.name);dirty();render()}
};
const CHG_ACC={
  usrole:el=>{const u=S.users.find(x=>x.id===el.dataset.id);if(!u)return;if(u.role==='admin'&&el.value!=='admin'&&S.users.filter(x=>x.role==='admin'&&x.on!==false).length<2){toast('لازم يفضل مدير واحد');render();return}u.role=el.value;if(u.id===S.cur&&!can('users')){UI.cfgTab='plan'}audit('تغيير دور '+u.name+' إلى '+roleName(u.role));dirty();render()},
  usron:el=>{const u=S.users.find(x=>x.id===el.dataset.id);if(!u)return;if(!el.checked&&u.id===S.cur){toast('مينفعش توقف نفسك');render();return}if(!el.checked&&u.role==='admin'&&S.users.filter(x=>x.role==='admin'&&x.on!==false).length<2){toast('لازم يفضل مدير واحد');render();return}u.on=el.checked;audit((u.on?'تشغيل ':'إيقاف ')+u.name);dirty();render()},
  usrpin:el=>{const u=S.users.find(x=>x.id===el.dataset.id),v=el.value.trim();if(!u||!v)return;if(v.length<4){toast('الرقم السري 4 أرقام على الأقل');el.value='';return}u.pin=pinHash(v);audit('رقم سري جديد: '+u.name);dirty();render()},
  rolep:el=>{const r=S.roles[el.dataset.r],p=el.dataset.p;if(!r||el.dataset.r==='admin')return;const i=r.perms.indexOf(p);if(el.checked&&i<0)r.perms.push(p);if(!el.checked&&i>=0)r.perms.splice(i,1);audit('صلاحية '+(PERM_NAME[p]||p)+' للدور '+r.name+': '+(el.checked?'مفتوحة':'مقفولة'));dirty()}
};
const INP_ACC={
  clnote:el=>{UI.cl=UI.cl||{};UI.cl.note=el.value},
  clreason:el=>{UI.cl=UI.cl||{};UI.cl.reason=el.value;const b=document.querySelector('[data-a=clreopen]');if(b)b.disabled=!el.value.trim()}
};
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target&&e.target.id==='lgpin'){e.preventDefault();ACT_ACC.lgdo()}});
