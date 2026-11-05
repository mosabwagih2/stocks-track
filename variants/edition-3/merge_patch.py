# executed from 5_redesign.py after the access patch (uses s, rep, ins_before, H)
ins_before("function vStock(){",(H/'redesign_merge.js').read_text(encoding='utf-8')+"\n")
# --- dashboard: no health tiles (one alert line), no top-10 / governorates (they live in Demand), team card at the bottom
a=s.index("  h+='<div class=\"gh\">صحة المخزون دلوقتي</div><div class=\"kpis\" style=\"margin-bottom:16px\">'")
b=s.index("  /* charts */",a)
s=s[:a]+"  h+=healthLine(Dd);\n"+s[b:]
rep("""  h+='<div class="grid g2" style="margin-top:16px">'+card('أعلى 10 أصناف '+(Dd.topBy==='ship'?'شحنًا':'طلبًا'),topC,per)+card('الأوردرات حسب المحافظة',govC,'عدد · قيمة')+'</div>';\n""","")
rep("  if(valC)h+='<div style=\"margin-top:16px\">'+valC+'</div>';\n  return h;","  if(valC)h+='<div style=\"margin-top:16px\">'+valC+'</div>';\n  h+=teamCard();\n  return h;")
rep("kpi('مستني الشحن (قيمة)'","kpi('أوردرات مفتوحة (قيمة)'")
# --- tabs
rep("const INS_TABS=[['dash','لوحة القيادة'],['demand','الطلب'],['plan','التصنيع'],['stuck','المعطل'],['health','صحة المخزون'],['team','الفريق']];","const INS_TABS=[['dash','نظرة عامة'],['demand','الطلب'],['plan','المخزون والتصنيع'],['stuck','المعطل']];")
rep("demand:insDemand2,plan:insPlan2,stuck:insStuck,team:insTeam,health:insHealth})","demand:insDemand2,plan:insStockPlan,stuck:insStuck})")
rep("if(UI.ins==='rate')UI.ins='plan';if(UI.ins==='over')UI.ins='dash';","if(UI.ins==='rate'||UI.ins==='health')UI.ins='plan';if(UI.ins==='over'||UI.ins==='team')UI.ins='dash';")
s=s.replace("['dash','demand','team'].indexOf(T)","['dash','demand'].indexOf(T)")
# --- demand: strip without the duplicated 'shipped' tile; top SKUs; rows re-arranged (colours+sizes, governorates+order size, bundles alone)
rep(",si('اتشحن',N(A.done),shareP(A.done,A.o)+'% من المطلوب','good')]);",
    "]);")
# --- Today: no subtitle
rep("""'الطلب من القنوات، اللي اتشحن فعلًا، واللي معطل.'+(isToday?'':' العرض للقراءة بس. الرفع والتسجيل بيتم على النهارده.'),tools)""","'',tools)")
# --- Today: scrap button + menu, factory receipt moves there
rep("""<button class="btn" data-a="recvmenu">استلام</button>""","""<button class="btn" data-a="recvmenu">استلام</button><button class="btn" data-a="scrapmenu">الهالك</button>""")
rep("  }else if(s.kind==='recv'){","  }else if(s.kind==='scrap'){\n    const r=scrapSheet();title=r.title;body=r.body;\n  }else if(s.kind==='recv'){")

rep("""<button class="btn" data-a="scrapmenu">الهالك</button>""","""<button class="btn" data-a="scrapmenu">الهالك</button>'+closeBtn()+'""")

rep("function vLedger(){","function vLedgerOld(){")
rep("function ledRows(){return UI.led.tab==='docs'?ledgerDocs():ledRowsOrig()}","function ledRowsOld(){return UI.led.tab==='docs'?ledgerDocs():ledRowsOrig()}")
ins_before("function vStock(){",(H/'redesign_ledger.js').read_text(encoding='utf-8')+"\n")
rep("Object.assign(ACT,ACT_ACC);","Object.assign(ACT,ACT_ACC,ACT_LG);Object.assign(CHG,CHG_LG);Object.assign(INP,INP_LG);")
csl="""<style>
.lgbar{display:flex;flex-direction:column;gap:10px;margin-bottom:12px}
.lgbar select,.lgbar input[type=date]{padding:7px 10px;font-size:13px;border-radius:10px;min-height:0}
.lgday{margin-bottom:12px;padding:16px 18px}.lgday h2{margin-bottom:6px!important}
.lgl{display:grid}
.lge{border-top:1px solid var(--grid)}.lge:first-child{border-top:0}
.lgr{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:12px;align-items:center;padding:11px 4px;cursor:pointer;border-radius:12px}
.lgr:not([data-a]){cursor:default}.lgr[data-a]:hover{background:var(--lav)}.lgr:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.lgt{display:grid;gap:1px;min-width:0}.lgt b{font-weight:600;line-height:1.5}.lgt small{font-size:12px}
.lgp{display:grid;justify-items:end;line-height:1.2}.lgp b{font-size:16px}.lgp small{font-size:11px}
.lge .chev{color:var(--muted);transition:transform .2s;width:18px;text-align:center}.lge.open .chev{transform:rotate(-90deg);color:var(--accent)}
.lgd{padding:4px 8px 14px 8px;display:grid;gap:6px}.lgmeta{font-size:12.5px}
@media (max-width:820px){.lgbar,.lgbar>*{min-width:0;max-width:100%}.lgbar .chips.scrollx{margin-inline:0;padding-inline:0}.lgday{padding:12px 12px;min-width:0}.lgl,.lge,.lgd{min-width:0}.lgd{overflow-x:auto}.lgr{gap:10px}.lgd{padding-inline:0}.lgm{grid-template-columns:1fr}}
</style>
"""
_i=s.index('<div id="app"></div>')
s=s[:_i]+csl+s[_i:]
