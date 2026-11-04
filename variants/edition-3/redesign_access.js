/* ---------- v2: users, roles, permissions, day close ----------
   Honest scope: everything here runs in the browser, so it keeps honest people honest and builds the audit trail.
   Real enforcement needs a server (the Supabase version). */
const PERMS=[['money','يشوف الفلوس والتكلفة'],['scan','شحن بالسكان'],['returns','استلام المرتجع'],['receive','استلام من المصنع'],['internal','هالك / غسيل / مفقود'],['ship','توريد للمحل'],['count','الجرد'],['pickup','رفع بيك أب'],['cancel','إلغاء أوردر'],['reverse','عكس عملية'],['catalog','تعديل الأصناف والموديلات'],['supplies','المستلزمات'],['settings','الإعدادات'],['users','المستخدمين والصلاحيات']];
const PERM_NAME=Object.fromEntries(PERMS);
const ROLE_DEFAULT={
  admin:{name:'مدير',perms:PERMS.map(p=>p[0])},
  sup:{name:'مشرف مخزن',perms:['scan','returns','receive','internal','ship','count','pickup','cancel','reverse','catalog','supplies']},
  pack:{name:'موظف شحن',perms:['scan','returns']},
  view:{name:'مراجعة (قراءة فقط)',perms:['money']}
};
const DOC_PERM={SCN:'scan',RTN:'returns',RCV:'receive',FRC:'internal',FSD:'internal',CLN:'internal',LOS:'internal',SHP:'ship',CNT:'count'};
const ACT_PERM={pksave:'pickup',pksave2:'pickup',pkdel:'pickup',pkdel2:'pickup',pkedit:'pickup',scansave:'scan',scsave:'scan',scedit:'scan',screv:'reverse',screv2:'reverse',cxopen:'cancel',cxgo:'cancel',uncx:'cancel',reverse:'reverse',
  reset:'settings',reset2:'settings',demoask:'settings',demoload:'settings',demoreset:'settings',
  skuadd:'catalog',catedit:'catalog',catsave:'catalog',skusave:'catalog',modelrm:'catalog',modelarch:'catalog',modelarch2:'catalog',modelrestore:'catalog',skuarch:'catalog',skuarch2:'catalog',skurestore:'catalog',skuop:'catalog',
  supsave:'supplies',supnew:'supplies',supconf:'supplies',suparch:'supplies',suparch2:'supplies',supundo:'supplies',supundo2:'supplies',undoentry:'supplies',supact:'supplies',
  usadd:'users',bkdl:'settings',bkyes:'settings',usdel:'users'};
const CLOSED_ACTS={pksave:1,pksave2:1,cxgo:1,supsave:1,supundo:1,supundo2:1,undoentry:1,supact:1};
const CHG_PERM={bkfile:'settings',cost:'settings',st:'settings',actor:'settings'};
function cyrb(s){let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677)}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return (4294967296*(2097151&h2)+(h1>>>0)).toString(36)}
const pinHash=p=>cyrb('fm|'+String(p).trim());
const navList=()=>NAV.filter(n=>n[0]!=='config'||can('settings')||can('users'));
function ensureAcc(s){
  if(!s.roles){s.roles={};Object.keys(ROLE_DEFAULT).forEach(k=>s.roles[k]={name:ROLE_DEFAULT[k].name,perms:ROLE_DEFAULT[k].perms.slice()})}
  if(!s.users||!s.users.length){s.users=[{id:'u1',name:s.actor||'مصعب',role:'admin',pin:null,on:true}];s.cur='u1'}
  if(!s.audit)s.audit=[];if(!s.closes)s.closes=[];s.lock='';
  if(!s.users.some(u=>u.id===s.cur))s.cur=s.users[0].id;
  s.actor=(s.users.find(u=>u.id===s.cur)||{}).name||s.actor;
}
const curUser=()=>(S.users||[]).find(u=>u.id===S.cur)||{role:'admin',name:S.actor};
function can(p){const u=curUser(),r=S.roles&&S.roles[u.role];return u.role==='admin'||!!(r&&r.perms.indexOf(p)>=0)}
function audit(m){S.audit.push({t:Date.now(),by:S.actor,m});if(S.audit.length>300)S.audit.splice(0,S.audit.length-300);dirty()}
function deny(p){toast('مش مسموح لدورك ('+curUser().role+'): '+(PERM_NAME[p]||p));return false}
const roleName=id=>(S.roles[id]||{name:id}).name;
const dayLocked=()=>false; /* day close was removed: nothing is ever locked by it */
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
function backupNudge(){const a=bkAge();if(!S.moves.length||!(a==null||a>7)||S.demo)return '';return '<div class="msg warn row sp dcb"><span>'+(a==null?'لسه ما اتاخدتش نسخة احتياطية من البيانات.':'آخر نسخة احتياطية من <b>'+a+'</b> يوم.')+' البيانات متخزنة في المتصفح بس.</span><button class="btn sm" data-a="bkdl">نزّل نسخة دلوقتي</button></div>'}
function dayCloseBar(){return backupNudge()}
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
   +S.users.map(u=>'<tr><td><b>'+esc(u.name)+'</b>'+(u.id===S.cur?' <span class="pill info">أنت</span>':'')+'</td><td><select data-c="usrole" data-id="'+u.id+'" aria-label="دور '+esc(u.name)+'">'+ro(u.role)+'</select></td><td>'+(u.pin?'<span class="pill good">متحط</span> ':'<span class="pill">مفيش</span> ')+'<input type="password" inputmode="numeric" placeholder="جديد" data-c="usrpin" data-id="'+u.id+'" style="width:90px"></td><td><input type="checkbox" data-c="usron" data-id="'+u.id+'" aria-label="'+esc(u.name)+' شغّال" '+(u.on!==false?'checked':'')+'></td><td>'+(u.id===S.cur?'':'<button class="btn sm danger" data-a="usdel" data-id="'+u.id+'">حذف</button>')+'</td></tr>').join('')
   +'</tbody></table></div><div class="picker" style="margin-top:12px"><label class="f">اسم جديد<input id="nu_name"></label><label class="f">الدور<select id="nu_role">'+ro('pack')+'</select></label><label class="f">رقم سري (اختياري)<input id="nu_pin" type="password" inputmode="numeric"></label><button class="btn pri" data-a="usadd">+ إضافة مستخدم</button></div>'
   +(adm<2?'<p class="muted" style="margin-top:8px;font-size:12.5px">لازم يفضل مدير واحد شغّال على الأقل.</p>':'')+'</section>';
  const rk=Object.keys(S.roles);
  h+='<section class="card"><h2>مصفوفة الصلاحيات <span class="hint">المدير دايمًا كل حاجة</span></h2><div class="tw"><table class="t-sm"><thead><tr><th>الصلاحية</th>'+rk.map(r=>'<th class="num">'+esc(S.roles[r].name)+'</th>').join('')+'</tr></thead><tbody>'
   +PERMS.map(p=>'<tr><td>'+p[1]+'</td>'+rk.map(r=>'<td class="num"><input type="checkbox" data-c="rolep" data-r="'+r+'" data-p="'+p[0]+'" aria-label="'+p[1]+' · '+esc(S.roles[r].name)+'" '+((r==='admin'||S.roles[r].perms.indexOf(p[0])>=0)?'checked':'')+(r==='admin'?' disabled':'')+'></td>').join('')+'</tr>').join('')+'</tbody></table></div></section>';
  h+='<section class="card"><h2>سجل النشاط <span class="hint">آخر 25</span></h2>'+(S.audit.length?'<div class="tl">'+S.audit.slice(-25).reverse().map(a=>'<div class="tli" style="grid-template-columns:minmax(0,1fr) auto"><span class="tt"><b>'+esc(a.m)+'</b><small class="muted">'+esc(a.by)+'</small></span><span class="muted" style="font-size:12px">'+timeOf(a.t)+'</span></div>').join('')+'</div>':'<div class="muted">لسه مفيش.</div>')+'</section>';
  return h;
}
function recvSheet(){
  const o=[['RCV','استلام من المصنع','قطع جديدة جت بورقة موقّعة','receive'],['RTN','استلام مرتجعات','اللي رجع من القنوات: سليم أو محتاج نضافة أو هالك','returns']];
  return {title:'استلام',body:'<div class="opgrid" style="grid-template-columns:1fr">'+o.map(x=>'<button class="op" data-a="recvgo" data-t="'+x[0]+'" '+(can(x[3])?'':'style="opacity:.55"')+'><span class="ic">'+ic(OT[x[0]].ic)+'</span><b>'+x[1]+'</b><small>'+x[2]+'</small></button>').join('')+'</div>'};
}
function firstDay(){let m=S.date;S.pickups.forEach(p=>{if(p.date<m)m=p.date});S.moves.forEach(x=>{if(x.date<m)m=x.date});return m}
function dateNav(date,isToday){
  const lo=firstDay();
  return '<span class="dnav" role="group" aria-label="اختيار اليوم"><button class="btn sm" data-a="vdstep" data-n="-1" '+(date<=lo?'disabled':'')+' aria-label="اليوم اللي قبله">›</button><input type="date" value="'+date+'" min="'+lo+'" max="'+S.date+'" data-c="vdpick" aria-label="اختار يوم"><button class="btn sm" data-a="vdstep" data-n="1" '+(isToday?'disabled':'')+' aria-label="اليوم اللي بعده">‹</button></span>'+(isToday?'':'<button class="btn sm" data-a="vdtoday">رجوع للنهارده</button>');
}
function bkAge(){return S.bk?Math.floor((Date.now()-S.bk)/864e5):null}
function backupBox(){
  const a=bkAge(),has=S.moves.length>0;
  return '<div class="msg '+(has&&(a==null||a>7)?'warn':'')+'" style="margin-bottom:12px"><b>نسخة احتياطية</b><div class="muted" style="margin:4px 0 10px;font-size:12.5px">'+(a==null?'لسه ما اتاخدتش نسخة.':a===0?'آخر نسخة: النهارده.':'آخر نسخة من '+a+' يوم.')+' الملف فيه كل العمليات والأوردرات والمستلزمات والمستخدمين والصور.</div>'
   +(UI.bkAsk?'<div class="msg crit"><b>استرجاع '+esc(UI.bkAsk.name)+'</b><br>'+esc(UI.bkAsk.text)+'<div class="row" style="margin-top:8px"><button class="btn danger sm" data-a="bkyes">أيوه، استرجع</button><button class="btn sm" data-a="bkno">لأ</button></div></div>'
    :'<div class="row"><button class="btn pri" data-a="bkdl">نزّل نسخة احتياطية</button><label class="btn">استرجاع من ملف<input type="file" accept=".json,application/json" data-c="bkfile" hidden></label></div>')+(UI.bkErr?'<div class="msg crit" style="margin-top:8px">'+esc(UI.bkErr)+'</div>':'')+'</div>';
}
function scrapSheet(){
  const o=[['CLN','تصنيف الحالة','قطعة بقت هالك نظافة أو هالك نهائي','internal'],['FSD','إرسال للمصنع','غسيل مجاني (هيرجع) أو هالك للتسليم','internal'],['FRC','استلام من المصنع','المغسول اللي رجع، والمرفوض بيتحول هالك نهائي','internal']];
  return {title:'الهالك',body:'<div class="opgrid" style="grid-template-columns:1fr">'+o.map(x=>'<button class="op" data-a="recvgo" data-t="'+x[0]+'"><span class="ic">'+ic(OT[x[0]].ic)+'</span><b>'+x[1]+'</b><small>'+x[2]+'</small></button>').join('')+'</div>'};
}
const ACT_ACC={
  scrapmenu:()=>{UI.sheet={kind:'scrap'};render()},
  bkdl:async()=>{const j=JSON.stringify({app:'femini-stock',v:3,at:Date.now(),state:S,photos:PH}),fn='femini-backup-'+S.date+'.json',blob=new Blob([j],{type:'application/json'}),done=()=>{S.bk=Date.now();audit('نسخة احتياطية ('+Math.round(j.length/1024)+' KB)');dirty();toast('اتنزّلت النسخة الاحتياطية');render()};
    let dl=null;try{dl=window.claude&&window.claude.use?await window.claude.use('downloads'):null}catch(e){dl=null}
    if(dl){try{await dl.save({filename:fn,data:blob});done()}catch(e){toast(e&&e.code==='declined'?'اتلغى التنزيل':'التنزيل مش متاح هنا. افتح الصفحة في المتصفح العادي وجرّب تاني.')}return}
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fn;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);done()},
  bkno:()=>{UI.bkAsk=null;UI.bkErr=null;UI._bk=null;render()},
  bkyes:()=>{const o=UI._bk;if(!o)return;try{S=o.state;ensureSup(S);ensureCat(S);rebuildCatalog();phClear();Object.keys(o.photos||{}).forEach(k=>{PH[k]=o.photos[k];phPut(k,o.photos[k])});S.date=cairoToday();_bal=null;_ctx=null;UI.bkAsk=null;UI._bk=null;UI.doc=null;UI.sheet=null;UI.vd=null;UI.locked=S.users.some(u=>u.pin);audit('استرجاع نسخة احتياطية');save();toast('اتسترجعت النسخة');render()}catch(e){UI.bkErr='فشل الاسترجاع: '+e.message;render()}},
  vdstep:el=>{const d=addDays(viewDate(),+el.dataset.n);if(d>=S.date)UI.vd=null;else if(d>=firstDay())UI.vd=d;render()},
  recvmenu:()=>{UI.sheet={kind:'recv'};render()},
  recvgo:el=>{const t=el.dataset.t,p=DOC_PERM[t];if(p&&!can(p)){deny(p);return}if(dayLocked(S.date)){toast('اليوم مقفول. لازم المدير يفتحه الأول');return}UI.sheet=null;go('ops',()=>{newDoc(t)})},
  whoami:()=>{UI.sheet={kind:'who'};render()},
  lockapp:()=>{UI.sheet=null;UI.locked=true;UI.lg=null;audit('قفل الشاشة');render()},
  lgpick:el=>{UI.lg=el.dataset.id?{id:el.dataset.id}:null;lockScreen()},
  lgdo:()=>{const u=S.users.find(x=>x.id===(UI.lg||{}).id);if(!u)return;const i=document.getElementById('lgpin');if(u.pin&&(!i||pinHash(i.value)!==u.pin)){UI.lg.err='الرقم السري غلط';lockScreen();audit('محاولة دخول فاشلة: '+u.name);return}unlockApp(u)},
  mypin:()=>{const i=document.getElementById('mypin'),v=i?i.value.trim():'';if(v.length<4){toast('الرقم السري 4 أرقام على الأقل');return}curUser().pin=pinHash(v);audit('تغيير رقم سري: '+S.actor);dirty();toast('اتحفظ');render()},
  mypinoff:()=>{curUser().pin=null;audit('إلغاء رقم سري: '+S.actor);dirty();render()},
  usadd:()=>{const n=(document.getElementById('nu_name').value||'').trim(),r=document.getElementById('nu_role').value,p=(document.getElementById('nu_pin').value||'').trim();
    if(!n){toast('اكتب الاسم');return}if(S.users.some(u=>u.name===n)){toast('الاسم متكرر');return}if(p&&p.length<4){toast('الرقم السري 4 أرقام على الأقل');return}
    S.users.push({id:'u'+(Date.now().toString(36)),name:n,role:r,pin:p?pinHash(p):null,on:true});audit('مستخدم جديد: '+n+' ('+roleName(r)+')');dirty();render()},
  usdel:el=>{const u=S.users.find(x=>x.id===el.dataset.id);if(!u||u.id===S.cur)return;if(u.role==='admin'&&S.users.filter(x=>x.role==='admin'&&x.on!==false).length<2){toast('لازم يفضل مدير واحد');return}S.users=S.users.filter(x=>x!==u);audit('حذف مستخدم: '+u.name);dirty();render()}
};
const CHG_ACC={
  bkfile:el=>{const f=el.files&&el.files[0];el.value='';if(!f)return;UI.bkErr=null;const r=new FileReader();r.onerror=()=>{UI.bkErr='مقدرتش أقرأ الملف.';render()};
    r.onload=()=>{try{const o=JSON.parse(r.result),st=o&&o.state;if(!o||o.app!=='femini-stock'||!st||st.v!==3||!Array.isArray(st.moves)||!Array.isArray(st.orders)||!Array.isArray(st.docs))throw new Error('الملف ده مش نسخة احتياطية من السيستم');
      const n=st.moves.length;UI.bkAsk={name:f.name,text:'فيها '+fmt(n)+' حركة و'+fmt(st.orders.length)+' أوردر و'+fmt(st.docs.length)+' عملية. ده هيستبدل كل اللي في المتصفح ده دلوقتي.'};UI._bk=o}catch(e){UI.bkErr=e.message;UI.bkAsk=null;UI._bk=null}render()};r.readAsText(f)},
  vdpick:el=>{const v=el.value;if(!v||v>=S.date)UI.vd=null;else if(v>=firstDay())UI.vd=v;render()},
  usrole:el=>{const u=S.users.find(x=>x.id===el.dataset.id);if(!u)return;if(u.role==='admin'&&el.value!=='admin'&&S.users.filter(x=>x.role==='admin'&&x.on!==false).length<2){toast('لازم يفضل مدير واحد');render();return}u.role=el.value;if(u.id===S.cur&&!can('users')){UI.cfgTab='plan'}audit('تغيير دور '+u.name+' إلى '+roleName(u.role));dirty();render()},
  usron:el=>{const u=S.users.find(x=>x.id===el.dataset.id);if(!u)return;if(!el.checked&&u.id===S.cur){toast('مينفعش توقف نفسك');render();return}if(!el.checked&&u.role==='admin'&&S.users.filter(x=>x.role==='admin'&&x.on!==false).length<2){toast('لازم يفضل مدير واحد');render();return}u.on=el.checked;audit((u.on?'تشغيل ':'إيقاف ')+u.name);dirty();render()},
  usrpin:el=>{const u=S.users.find(x=>x.id===el.dataset.id),v=el.value.trim();if(!u||!v)return;if(v.length<4){toast('الرقم السري 4 أرقام على الأقل');el.value='';return}u.pin=pinHash(v);audit('رقم سري جديد: '+u.name);dirty();render()},
  rolep:el=>{const r=S.roles[el.dataset.r],p=el.dataset.p;if(!r||el.dataset.r==='admin')return;const i=r.perms.indexOf(p);if(el.checked&&i<0)r.perms.push(p);if(!el.checked&&i>=0)r.perms.splice(i,1);audit('صلاحية '+(PERM_NAME[p]||p)+' للدور '+r.name+': '+(el.checked?'مفتوحة':'مقفولة'));dirty()}
};
const INP_ACC={};
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target&&e.target.id==='lgpin'){e.preventDefault();ACT_ACC.lgdo()}});
