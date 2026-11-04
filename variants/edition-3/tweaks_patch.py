# executed from 5_redesign.py (uses s, rep)
# 1) stock: no "one model" view
rep("""<button aria-pressed="'+(s.view==='matrix')+'" data-a="sview" data-v="matrix">موديل واحد</button>""","")
rep("  if(s.view==='list'){return stockList()}","  if(s.view==='matrix')s.view='list';\n  if(s.view==='list'){return stockList()}")
# 2) scan upload: the employee is the signed-in account
_a=s.index("      body+='<label class=\"f\">اسم الموظف (اللي سكان)<input id=\"upemp\"")
_b=s.index("</datalist>';",_a)+len("</datalist>';")
s=s[:_a]+"      s.emp=S.actor;body+='<p class=\"muted\" style=\"font-size:12.5px;margin:0 0 8px\">الشحن هيتسجّل باسم <b>'+esc(S.actor)+'</b>.</p>';"+s[_b:]
s=s.replace("emp:S.emps[S.emps.length-1]||'',res:null","emp:S.actor,res:null")
# 3) a focused nav button must not jump to another tab after a re-render (space/enter)
rep("const ks=['data-a','data-c','data-k','data-v','data-sku','data-id','data-m','data-i','data-f','data-ref'];","const ks=['data-a','data-c','data-k','data-v','data-sku','data-id','data-m','data-i','data-f','data-ref','data-t','data-p','data-d','data-n','data-w','data-l','data-z'];")
# 4) after a mouse or touch click the button must not keep focus (a stray space or enter would press it again)
rep("if(!gateAct(el))return;ACT[el.dataset.a](el,e)}","if(!gateAct(el))return;ACT[el.dataset.a](el,e);if(e.detail>0){const _a=document.activeElement;if(_a&&_a.tagName==='BUTTON')_a.blur()}}")
# 5) no reversing of operations anywhere in the interface
rep("""(d.status==='done'?phv+'<div style="margin-top:12px"><button class="btn danger sm" data-a="reverse">عكس العملية</button><div class="muted" style="font-size:12px;margin-top:6px">بتسجّل حركة عكسية. السجل الأصلي بيفضل زي ما هو.</div></div>':'')""","""(d.status==='done'?phv:'')""")
_a=s.index("""    body+='<div class="card flat" style="margin-top:6px"><h2 style="font-size:15px">عكس الملف كله</h2>'""")
_b=s.index("\n",_a)
s=s[:_a]+s[_b+1:]
import re as _re
for _n in ('reverse','screv','screv2'):
    _m=_re.search(r"\n  "+_n+r":[^\n]*\n",s)
    assert _m,_n
    s=s[:_m.start()+1]+s[_m.end():]
# 6) supplies: archived items live on their own page; restoring asks first
rep("""  suprestore:el=>{const it=supItem(el.dataset.id);it.arch=false;dirty();if(!S.sup.items.some(i=>i.arch))UI.supArch=false;toast('اترجّع: '+it.name);render()},""","""  suprestore:el=>{UI.supAsk=el.dataset.id;render()},
  suprestoreyes:()=>{const it=supItem(UI.supAsk);UI.supAsk=null;if(!it)return;it.arch=false;dirty();if(!S.sup.items.some(i=>i.arch))UI.supArch=false;toast('اترجّع: '+it.name);render()},
  suprestoreno:()=>{UI.supAsk=null;render()},
  suparchgo:()=>{go('supplies',()=>{UI.supArch=true})},""")
rep("""  if(!items.length)h+='<div class="card"><div class="empty">'+(UI.supArch?""","""  if(UI.supAsk){const _i=supItem(UI.supAsk);if(_i)h+='<div class="msg warn row sp" style="margin-bottom:14px"><span>هترجّع <b>'+esc(_i.name)+'</b>، وهيرجع يتخصم لوحده مع الأوردرات. متأكد؟</span><span class="row" style="gap:8px"><button class="btn sm pri" data-a="suprestoreyes">أيوه، رجّعه</button><button class="btn sm" data-a="suprestoreno">لأ</button></span></div>'}
  if(!items.length)h+='<div class="card"><div class="empty">'+(UI.supArch?""")
rep("""S.sup.items.map(i=>'<tr style="'+(i.arch?'opacity:.6':'')+'">""","""S.sup.items.filter(i=>!i.arch).map(i=>'<tr style="'+(i.arch?'opacity:.6':'')+'">""")
rep("""افتح صفحة المستلزمات</button>""","""افتح صفحة المستلزمات</button>'+(S.sup.items.some(i=>i.arch)?'<button class="btn sm ghost" data-a="suparchgo">المؤرشفة ('+S.sup.items.filter(i=>i.arch).length+')</button>':'')+'""")
