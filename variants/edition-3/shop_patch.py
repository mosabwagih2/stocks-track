# executed from 5_redesign.py (uses s, rep, ins_before, H)
ins_before("function vStock(){",(H/'redesign_shop.js').read_text(encoding='utf-8')+"\n")
rep("""if(d.type==='SHP')h+='<label class="f">ملاحظة<input value="'+esc(H.note)+'" data-c="h" data-f="note" '+dis+'></label>';""","""if(d.type==='SHP')h+='<label class="f">المحل<input list="shopsl" value="'+esc(H.shop||'')+'" data-c="h" data-f="shop" placeholder="اسم المحل أو الفرع" '+dis+'></label><datalist id="shopsl">'+(S.shops||[]).map(x=>'<option value="'+esc(x)+'">').join('')+'</datalist><label class="f">ملاحظة (اختياري)<input value="'+esc(H.note)+'" data-c="h" data-f="note" '+dis+'></label>';""")
rep("if(draft&&(d.type==='RCV'||d.type==='SHP'))h+=","if(draft&&d.type==='RCV')h+=")
rep("""    L.forEach(l=>add(l.sku,num(l.q),'READY','EXT_SHOP','توريد للمحل'+(H.note?' · '+H.note:'')));
    chk(L.length>0,'فيه أصناف مضافة');chk(PH[d.id]||d.photo,'صورة الورقة الموقّعة مرفوعة');""","""    L.forEach(l=>add(l.sku,num(l.q),'READY','EXT_SHOP','توريد للمحل'+(H.shop?' · '+H.shop:'')+(H.note?' · '+H.note:'')));
    chk(L.length>0,'فيه أصناف مضافة');chk((H.shop||'').trim(),'اسم المحل مكتوب');""")
rep("d:'قطع للمحل بورقة موقّعة'","d:'قطع للمحل، وبتطلع إذن تسليم تطبعه'")
rep("const phv=(d.type==='RCV'||d.type==='SHP')?","const phv=(d.type==='RCV')?")
rep("""h+='<section class="card"><h2>الحالة</h2>'+(d.status==='done'?'<div class="msg good">اتأكدت وسجّلت '""","""h+=(d.type==='SHP'?shpCard(d):'')+'<section class="card"><h2>الحالة</h2>'+(d.status==='done'?'<div class="msg good">اتأكدت وسجّلت '""")
rep("""d.no?'رقم <span class="mono">'+d.no+'</span> · '+d.date:'مسودة.""","""d.no?'رقم <span class="mono">'+d.no+'</span> · '+d.date+(d.confirmedAt?' · '+timeOf(d.confirmedAt):''):'مسودة.""")
rep("let h=top('العمليات','كل حاجة بتغيّر المخزون بتتسجل هنا. اختار اللي عملته.','');","let h=top('العمليات','كل حاجة بتغيّر المخزون بتتسجل هنا. اختار اللي عملته.','')+opTabs();if(UI.opTab==='shop')return h+shopPage();")
rep("  post(r.mv,d);\n  if(d.type==='SCN'){","  post(r.mv,d);\n  if(d.type==='SHP'){const _sh=(d.hdr.shop||'').trim();d.hdr.shop=_sh;S.shops=S.shops||[];if(_sh&&S.shops.indexOf(_sh)<0)S.shops.push(_sh)}\n  if(d.type==='SCN'){")
rep("  }else if(s.kind==='who'){","  }else if(s.kind==='shpnote'){\n    const r=shpNoteSheet(s);title=r.title;body=r.body;\n  }else if(s.kind==='who'){")
rep("Object.assign(ACT,ACT_ACC,ACT_LG,ACT_RT);Object.assign(CHG,CHG_LG,CHG_RT);Object.assign(INP,INP_LG);","Object.assign(ACT,ACT_ACC,ACT_LG,ACT_RT,ACT_SH);Object.assign(CHG,CHG_LG,CHG_RT,CHG_SH);Object.assign(INP,INP_LG,INP_SH);")
# stock: the state chips filter what is listed (lost, factory, scrap, cleaning show only what has pieces there)
rep("""const groups={},OM=ordM().filter(c=>!sq||modelHit(c,sq));""","""const groups={},OM=ordM().filter(c=>(!sq||modelHit(c,sq))&&(s.state==='READY'||mSum(c,s.state)>0));""")
rep("""h+=none||('<div class="stack mxgrid">'""","""h+=none||(!OM.length?'<div class="card"><div class="empty">مفيش قطع في '+LOC[s.state]+'.</div></div>':'<div class="stack mxgrid">'""")
rep("""    if(q.length&&!skuHit(k,q))return false;
    return true;
  }).map(k=>k.id);""","""    if(q.length&&!skuHit(k,q))return false;
    if(s.state!=='READY'&&g(k.id,s.state)<=0)return false;
    return true;
  }).map(k=>k.id);""")
csn="""<style>
.notef{width:100%;height:66vh;border:1px solid var(--line);border-radius:12px;background:#fff}
.shpt td{vertical-align:middle}
</style>
"""
_i=s.index('<div id="app"></div>')
s=s[:_i]+csn+s[_i:]
