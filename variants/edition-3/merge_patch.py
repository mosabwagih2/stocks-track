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
