# executed from 5_redesign.py (uses s, rep, ins_before, H)
ins_before("function vStock(){",(H/'redesign_access.js').read_text(encoding='utf-8')+"\n")
rep("function ensureSup(s){","function ensureSup(s){ensureAcc(s);")
rep("const EGP=n=>fmt(Math.round(n))+' ج';","const EGP=n=>can('money')?fmt(Math.round(n))+' ج':'•••';")
rep("const EGPh=n=>'<span class=\"n\">'+fmt(Math.round(n))+'</span><span class=\"cur\">ج</span>';","const EGPh=n=>can('money')?'<span class=\"n\">'+fmt(Math.round(n))+'</span><span class=\"cur\">ج</span>':'<span class=\"n\">•••</span>';")
rep("function confirmDoc(d){","function confirmDoc(d){const _p=DOC_PERM[d.type];if(_p&&!can(_p)){deny(_p);return false}")
rep("function reverseDoc(d){","function reverseDoc(d){if(!can('reverse')){deny('reverse');return {ok:false,err:['مش مسموح لدورك']}}")
rep("function cxApply(s){","function cxApply(s){if(!can('cancel')||dayLocked(S.date))return false;")
rep("  if(d.type!=='SCN')chk(d.date<=S.date&&d.date>=addDays(S.date,-3),'التاريخ ضمن آخر 3 أيام ومش في المستقبل');","  if(d.type!=='SCN')chk(d.date<=S.date&&d.date>=addDays(S.date,-3),'التاريخ ضمن آخر 3 أيام ومش في المستقبل');\n  chk(!dayLocked(d.date),'اليوم ده مقفول. المدير لازم يفتحه الأول');")
rep("document.addEventListener('click',e=>{","Object.assign(ACT,ACT_ACC);Object.assign(CHG,CHG_ACC);Object.assign(INP,INP_ACC);\ndocument.addEventListener('click',e=>{")
rep("  if(ACT[el.dataset.a])ACT[el.dataset.a](el,e);","  if(ACT[el.dataset.a]){if(!gateAct(el))return;ACT[el.dataset.a](el,e)}")
rep("document.addEventListener('change',e=>{const el=e.target.closest('[data-c]');if(el&&CHG[el.dataset.c])CHG[el.dataset.c](el)});","document.addEventListener('change',e=>{const el=e.target.closest('[data-c]');if(el&&CHG[el.dataset.c]){const p=CHG_PERM[el.dataset.c];if(p&&!can(p)){deny(p);render();return}CHG[el.dataset.c](el)}});")
rep("function render(){","function render(){if(UI.locked==null)UI.locked=S.users.some(u=>u.pin);if(UI.locked){lockScreen();return}{const _l=document.getElementById('lockscr');if(_l)_l.remove()}")
rep("+NAV.map(n=>'<button class=\"nav'","+navList().map(n=>'<button class=\"nav'")
rep("NAV.filter(n=>SEC[n[0]]).map(n=>'<button class=\"op mini\"","navList().filter(n=>SEC[n[0]]).map(n=>'<button class=\"op mini\"")
rep("<span>'+esc(S.actor)+' · نسخة تجريبية</span>","<button class=\"tbtn\" data-a=\"whoami\">👤 '+esc(S.actor)+' · '+esc(roleName(curUser().role))+'</button>")
rep("  }else if(s.kind==='hcell'){","  }else if(s.kind==='close'){\n    const r=closeSheet();title=r.title;body=r.body;\n  }else if(s.kind==='who'){\n    const r=whoSheet();title=r.title;body=r.body;\n  }else if(s.kind==='hcell'){")
rep("['sys','المستخدمين والبيانات',['المستخدمين','البيانات']],['demo','داتا تجريبية وجولة',[]]]","['acc','المستخدمين والصلاحيات',[]],['sys','البيانات',['البيانات']],['demo','داتا تجريبية وجولة',[]]]")
rep("(tab[0]==='demo'?vDemo():'')","(tab[0]==='demo'?vDemo():tab[0]==='acc'?vAccess():'')")
csa="""<style>
#lockscr{position:fixed;inset:0;z-index:200;background:var(--page);display:grid;place-items:center;padding:20px}
.lk{width:100%;max-width:520px}.lkc{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:28px;display:grid;gap:14px;box-shadow:var(--shadow)}
.lkc h2{font-size:22px}.lku{display:grid;gap:10px}
.lku1{all:unset;box-sizing:border-box;cursor:pointer;display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:12px;align-items:center;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}
.lku1:hover{border-color:var(--accent);background:var(--lav)}.lku1 i{grid-row:1/3;width:40px;height:40px;border-radius:40px;background:var(--accent);color:var(--on-accent);display:grid;place-items:center;font:600 16px var(--f-disp);font-style:normal}
.lku1 b{font-weight:600}.lku1 small{color:var(--muted)}.lku1.me{display:inline-grid;grid-template-columns:auto;pointer-events:none;padding:0;border:0}
.lkp{display:grid;gap:12px}.lkp input{font-size:18px;text-align:center;letter-spacing:.3em}
.dcb{margin-bottom:12px}
.chk .wn::before{content:"!";color:var(--warn);font-weight:700;width:12px;text-align:center}
</style>
"""
_i=s.index('<div id="app"></div>')
s=s[:_i]+csa+s[_i:]

rep("window.__F={S:()=>S,","window.__F={can:(p)=>can(p),deny:(p)=>deny(p),curUser:()=>curUser(),closeSnap:(d)=>closeSnap(d),closeChecks:(d)=>closeChecks(d),dayLocked:(d)=>dayLocked(d),INTERNAL,S:()=>S,")
rep("d.log.push(logE(\x27اتعكست\x27));","")

rep("  }else if(s.kind==='close'){","  }else if(s.kind==='recv'){\n    const r=recvSheet();title=r.title;body=r.body;\n  }else if(s.kind==='close'){")
rep("""'<button class="btn sm" data-a="vdtoday">رجوع للنهارده</button>')+'<button class="btn" data-a="upload" data-t="pickup">رفع بيك أب</button>""","""'<button class="btn sm" data-a="vdtoday">رجوع للنهارده</button>')+'<button class="btn" data-a="upload" data-t="pickup">رفع بيك أب</button><button class="btn" data-a="recvmenu">استلام</button>""")

rep("""const tools='<span class="pill '+(isToday?'good':'warn')+'">'+(isToday?'النهارده · ':'بتعرض يوم سابق · ')+esc(dayName(date))+'</span>'+(isToday?'':'<button class="btn sm" data-a="vdtoday">رجوع للنهارده</button>')+""","""const tools=dateNav(date,isToday)+""")
rep("""let h=top(isToday?'النهارده':'يوم سابق',""","""let h=top((isToday?'النهاردة':'يوم سابق')+'<span class="pill tdate '+(isToday?'good':'warn')+'">'+(isToday?'النهارده · ':'بتعرض يوم سابق · ')+esc(dayName(date))+'</span>',""")
csd2="""<style>
.tdate{font:600 13px var(--f-ar)!important;vertical-align:middle;margin-inline-start:12px;position:relative;top:-3px}
.dnav{display:inline-flex;align-items:center;gap:4px}
.dnav input[type=date]{padding:6px 10px;font:500 13px var(--f-mono);border-radius:10px;min-height:0;direction:ltr}
.dnav .btn.sm{padding:6px 11px;font-size:16px;line-height:1}
@media (max-width:820px){.dnav{grid-column:1/-1;justify-content:center}.dnav input[type=date]{flex:1;font-size:15px;min-height:40px}.tdate{display:block;margin:6px 0 0;top:0;width:max-content}}
</style>
"""
_i=s.index('<div id="app"></div>')
s=s[:_i]+csd2+s[_i:]
