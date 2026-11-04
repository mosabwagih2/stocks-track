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
