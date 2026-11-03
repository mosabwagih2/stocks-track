import pathlib
H=pathlib.Path(__file__).parent;T=H/'.work'
s=(T/'base.html').read_text(encoding='utf-8')
def rep(a,b):
    global s
    assert s.count(a)==1,(a[:80],s.count(a))
    s=s.replace(a,b)
def ins_before(anchor,code):
    rep(anchor,code+anchor)

# ================= STOCK =================
ins_before("function vStock(){",(H/'redesign_stock.js').read_text(encoding='utf-8')+"\n")
rep("const s=UI.s,sq=stockQ();let h='';\n  if(s.view==='table'){","const s=UI.s,sq=stockQ();let h='';\n  if(s.view==='list'){return stockList()}\n  if(s.view==='table'){")
rep("""const tools='<div class="seg"><button aria-pressed="'+(s.view==='all')+'" data-a="sview" data-v="all">كل الموديلات</button>""","""const tools='<div class="seg"><button aria-pressed="'+(s.view==='list')+'" data-a="sview" data-v="list">قائمة</button><button aria-pressed="'+(s.view==='all')+'" data-a="sview" data-v="all">مصفوفات</button>""")
rep("s:{m:'BR2',state:'READY',q:'',view:'all'}","s:{m:'BR2',state:'READY',q:'',view:'list'}")
rep("  more:()=>{UI.sheet={kind:'more'};render()},","  more:()=>{UI.sheet={kind:'more'};render()},\n  mexp:el=>{const m=el.dataset.m;UI.s.open=UI.s.open||{};UI.s.open[m]=!UI.s.open[m];render()},\n  mexpall:()=>{UI.s.open=UI.s.open||{};const sq=stockQ(),ms=MORDER.filter(c=>!sq||modelHit(c,sq)),all=ms.every(c=>UI.s.open[c]);ms.forEach(c=>UI.s.open[c]=!all);render()},")

css=r"""<style>
/* ===== v2: data-first layout. Summaries first, details on demand. ===== */
.strip{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);background:var(--surface);border:1px solid var(--line);border-radius:14px;margin-bottom:14px;overflow:hidden}
.strip .si{all:unset;box-sizing:border-box;display:grid;gap:2px;padding:12px 16px;border-inline-end:1px solid var(--line);align-content:center;min-width:0}
.strip .si:last-child{border-inline-end:0}
.strip button.si{cursor:pointer}.strip button.si:hover{background:var(--lav)}
.strip .si small{color:var(--muted);font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.strip .si b{font:600 22px/1.2 var(--f-mono);letter-spacing:-.02em;white-space:nowrap}
.strip .si em{font-style:normal;color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.strip .si.crit b{color:var(--crit)}.strip .si.warn b{color:var(--warn)}.strip .si.good b{color:var(--good)}
.dt{border-collapse:separate;border-spacing:0}
.sd{display:inline-block;width:9px;height:9px;border-radius:99px;margin-inline-end:7px;vertical-align:1px;background:var(--line2)}
.sd.crit{background:var(--c-scrap)}.sd.warn{background:var(--c-dirty)}.sd.good{background:var(--c-ready)}.sd.info{background:var(--c-factory)}
.sdt{font-size:13px}
.rb{display:inline-block;width:70px;height:7px;border-radius:99px;background:var(--grid);overflow:hidden;vertical-align:middle;margin-inline-end:8px}
.rb i{display:block;height:100%;border-radius:99px;background:var(--accent)}.rb i.c{background:var(--c-scrap)}.rb i.w{background:var(--c-dirty)}.rb i.g{background:var(--c-ready)}
.cvr{white-space:nowrap}
.stkl .mrow{cursor:pointer}
.mo{display:none}
.stkl .mrow .chev{color:var(--muted);text-align:center;transition:transform .2s}
.stkl .mrow.open .chev{transform:rotate(-90deg);color:var(--accent)}
.stkl .mrow.open td{background:var(--lav)}
.stkl tr.mopen>td{padding:10px 12px 16px;background:var(--surface);border-bottom:1px solid var(--line)}
.stkl .mhead{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px}
@media (max-width:820px){
  .strip{grid-auto-flow:row;grid-template-columns:repeat(2,minmax(0,1fr))}
  .strip .si{border-inline-end:0;border-bottom:1px solid var(--line);padding:10px 14px}
  .strip .si b{font-size:19px}
  .stkl th:nth-child(3),.stkl td:nth-child(3),.stkl th:nth-child(4),.stkl td:nth-child(4){display:none}
  .stkl .rb{width:44px}
  .dt tr.grp td{top:0}
}
</style>
"""
i=s.index('<div id="app"></div>')
s=s[:i]+css+s[i:]

# ================= ORDERS / LEDGER / SUPPLIES / SETTINGS / OPS / TODAY =================
rest=(H/'redesign_rest.js').read_text(encoding='utf-8')
# the settings wrapper needs the original under another name
rep("function vConfig(){","function vConfigOrig(){")
# insert all v2 helpers once, before vOrders (after the original ordRows so the new ordRows wins)
ins_before("function vOrders(){",rest+"\n")
# --- orders
rep("""h+='<div class="grid g3" style="margin-bottom:14px">'+S.pickups.map(p=>{""","""h+=ordStrip();if(false)h+='<div class="grid g3" style="margin-bottom:14px">'+S.pickups.map(p=>{""")
rep("""<table class="ordtbl"><thead><tr><th style="width:36px"></th><th>كود الأوردر</th><th>البوليصة</th><th>النوع</th><th>المحافظة</th><th class="num">قطع</th><th>الحالة</th></tr></thead>""","""<table class="dt ordt"><thead><tr><th style="width:36px"></th><th>الأوردر / البوليصة</th><th>المحافظة</th><th class="num">قطع</th><th class="num">القيمة (ج)</th><th>الحالة</th></tr></thead>""")
# --- ledger
rep("function ledRows(){","function ledRowsOrig(){")
ins_before("function vLedger(){","function ledRows(){return UI.led.tab==='docs'?ledgerDocs():ledRowsOrig()}\n")
rep("""<button role="tab" aria-selected="'+(L.tab==='moves')+'" data-a="ltab" data-v="moves">الحركات</button>""","""<button role="tab" aria-selected="'+(L.tab==='docs')+'" data-a="ltab" data-v="docs">المستندات</button><button role="tab" aria-selected="'+(L.tab==='moves')+'" data-a="ltab" data-v="moves">كل الحركات</button>""")
rep("led:{q:'',type:'',tab:'moves',n:150}","led:{q:'',type:'',tab:'docs',n:150}")
rep("  lq:el=>{UI.led.q=el.value;$('#ledres').innerHTML=ledRows()},","  lq:el=>{UI.led.q=el.value;$('#ledres').innerHTML=ledRows();_L.main=null},")
rep("  more:()=>{UI.sheet={kind:'more'};render()},","  more:()=>{UI.sheet={kind:'more'};render()},\n  ldoc:el=>{const L=UI.led;L.open=L.open||{};L.open[el.dataset.k]=!L.open[el.dataset.k];render()},\n  ldmore:()=>{UI.led.nd=(UI.led.nd||10)+10;render()},\n  cfgtab:el=>{UI.cfgTab=el.dataset.v;render()},")
# --- supplies
a=s.index("  h+='<div class=\"grid g3\">'+items.map(it=>{\n    const b=supBal(it.id)");b=s.index("  const lg=S.sup.log.slice(-30).reverse();")
s=s[:a]+"  h+=supStrip(S.sup.items.filter(i=>!i.arch));h+=supTable(items);\n"+s[b:]
a=s.index("  h+='<h2 style=\"font-size:17px;margin:22px 0 10px\">آخر الحركات</h2>");b=s.index("  return h;",a)
s=s[:a]+"  h+='<h2 style=\"font-size:17px;margin:22px 0 10px\">آخر الحركات</h2>'+supLogGrouped();\n"+s[b:]
# --- ops launcher
a=s.index("  ['دخول','خروج','داخلي','رقابة'].forEach(g_=>{");b=s.index("\n  });",a)+len("\n  });")
s=s[:a]+"""  const dr=S.docs.filter(x=>x.status==='draft');
  if(dr.length)h+='<section class="card" style="margin-bottom:14px;border-color:var(--warn-line)"><h2>مسودات محتاجة تكمل <span class="hint">'+dr.length+'</span></h2><div class="chips">'+dr.map(x=>'<button class="chip" data-a="opendoc" data-id="'+x.id+'">'+esc(OT[x.type].ar)+' · '+x.lines.length+' صنف</button>').join('')+'</div></section>';
  h+='<div class="launch">'+['دخول','خروج','داخلي','رقابة'].map(g_=>'<section class="card flat lg"><h3>'+g_+'</h3>'+OPS_LIST.filter(t=>OT[t].grp===g_).map(t=>'<button class="lop" data-a="newop" data-t="'+t+'"><span class="ic">'+ic(OT[t].ic)+'</span><span><b>'+OT[t].ar+'</b><small>'+OT[t].d+'</small></span></button>').join('')+'</section>').join('')+'</div>';"""+s[b:]
# --- today: pickups table + values
a=s.index("    h+='<div style=\"margin-top:14px;display:grid;gap:4px\">'+pks.map(p=>{");b=s.index("  }\n  h+='</section>';",a)
s=s[:a]+"""    const vv=a=>a.reduce((x,o)=>x+ordVal(o),0);
    h+='<div class="strip" style="margin:14px 0 0">'+si('قيمة المطلوب',N(Math.round(vv(os)/1000))+'<span class="muted" style="font-size:13px;font-weight:500"> ألف ج</span>','')+si('اتشحن',N(Math.round(vv(done)/1000))+'<span class="muted" style="font-size:13px;font-weight:500"> ألف ج</span>','','good')+si('واقف بالرصيد',N(Math.round(vv(blk)/1000))+'<span class="muted" style="font-size:13px;font-weight:500"> ألف ج</span>','',blk.length?'crit':'')+'</div>';
    h+='<div class="tw" style="margin-top:12px"><table class="dt"><thead><tr><th>البيك أب</th><th>القناة</th><th>التقدم</th><th class="num">قطع</th><th class="num">القيمة</th></tr></thead><tbody>'+pks.map(p=>{const po=S.orders.filter(o=>o.pk===p.id&&o.st!=='cx'),pd=po.filter(o=>o.st==='done').length;
      return '<tr data-a="gopk" data-id="'+p.id+'" style="cursor:pointer"><td><b>'+esc(p.label)+'</b></td><td class="muted">'+esc(chanName(p.channel))+'</td><td><span class="cvr">'+bar(pd,po.length,'g')+'<span class="n">'+pd+' / '+po.length+'</span></span></td><td class="num">'+N(po.reduce((x,o)=>x+o.lines.length,0))+'</td><td class="num">'+EGP(vv(po))+'</td></tr>'}).join('')+'</tbody></table></div>';
"""+s[b:]
css2=r"""<style>
.dt>thead>tr>th{position:sticky;top:0;background:var(--lav);font-size:12px;color:var(--muted);font-weight:600;padding:9px 12px;border-bottom:1px solid var(--line);text-align:start}
.dt>tbody>tr>td{padding:8px 12px;border-bottom:1px solid var(--grid)}
.dt>tbody>tr.grp>td{background:color-mix(in srgb,var(--lav) 70%,var(--surface));font-size:13px;padding:7px 12px;border-bottom:1px solid var(--line)}
.dt>tbody>tr:not(.grp):not(.mopen):hover>td{background:var(--lav)}
.dt>tbody>tr>td.num,.dt>thead>tr>th.num{text-align:center}
.lrow,.mrow{cursor:pointer}
.lrow .chev{color:var(--muted);text-align:center;transition:transform .2s}.lrow.open .chev{transform:rotate(-90deg);color:var(--accent)}.lrow.open>td{background:var(--lav)}
.dt>tbody>tr.mopen>td{background:var(--surface);padding:10px 14px 14px}
.lgm{display:grid;grid-template-columns:200px minmax(0,1fr);gap:10px;padding:6px 0;border-bottom:1px dashed var(--grid);align-items:start}
.lgx{width:auto;border-collapse:separate;border-spacing:3px;font-size:12.5px}
.lgx th{background:none;position:static;border:0;color:var(--muted);font-weight:600;padding:2px 8px;font-size:12px;text-align:center}
.lgx td{border:0;min-width:34px;text-align:center;padding:4px 6px;border-radius:7px;background:var(--lav)}
.lgx td.z{background:transparent;color:var(--line2)}
.lgx td.tt{background:transparent;border-inline-start:1px solid var(--line)}
.lgx td.cl{text-align:start;white-space:nowrap;background:transparent;padding-inline-end:10px}
.lgn{display:grid;gap:2px}
.lgm:last-of-type{border-bottom:0}
.lgc{display:flex;flex-wrap:wrap;gap:6px}
.lc{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:8px;background:var(--lav);border:1px solid var(--line);font-size:12.5px;white-space:nowrap}
.flw{white-space:nowrap;font-size:13px}
.launch{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:8px}
.launch .lg{padding:12px;display:grid;gap:4px;align-content:start}
.launch h3{margin:0 0 4px;font-size:12px;color:var(--muted);letter-spacing:.06em}
.lop{all:unset;box-sizing:border-box;display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:center;padding:8px;border-radius:10px;cursor:pointer}
.lop:hover{background:var(--lav)}
.lop .ic{width:32px;height:32px;border-radius:9px;background:var(--lav);display:grid;place-items:center;color:var(--accent)}
.lop .ic svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.lop b{display:block;font-weight:600}.lop small{display:block;color:var(--muted);line-height:1.35;font-size:12px}
@media (max-width:1000px){.launch{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:820px){
  .tw:has(>table.dt){overflow-x:auto!important;border:1px solid var(--line)!important;background:var(--surface)!important;border-radius:14px!important}
  .stkl tr.mopen,.stkl tr.mopen>td,.ledt tr.mopen,.ledt tr.mopen>td{display:block;width:100%}
  .stkl tr.mopen>td{padding:8px 6px 14px}
  .stkl th:nth-child(5),.stkl td:nth-child(5),.stkl th:nth-child(6),.stkl td:nth-child(6){display:none}
  .stkl .mo{display:block;font-size:12px;color:var(--muted);margin-top:2px}
  .stkl td:first-child{max-width:56vw}
  .stkl td:first-child .muted{display:none}
  .stkl td,.stkl th{padding-inline:8px}
  .strip .si em{display:none}.strip .si{padding:10px 14px}.strip .si b{font-size:18px}
  .supt th:nth-child(3),.supt td:nth-child(3),.supt th:nth-child(4),.supt td:nth-child(4),.supt th:nth-child(5),.supt td:nth-child(5){display:none}
  .supt td:last-child .row{flex-direction:column;align-items:stretch}
}
@media (max-width:820px){
  .launch{grid-template-columns:1fr}
  .ordt th:nth-child(3),.ordt td:nth-child(3),.ordt th:nth-child(5),.ordt td:nth-child(5){display:none}
  .ledt th:nth-child(1),.ledt td:nth-child(1),.ledt th:nth-child(3),.ledt td:nth-child(3),.ledt th:nth-child(6),.ledt td:nth-child(6),.ledt th:nth-child(7),.ledt td:nth-child(7){display:none}
  .lgm{grid-template-columns:1fr}
}
</style>
"""
i=s.index('<div id="app"></div>')
s=s[:i]+css2+s[i:]

# ================= TODAY + ANALYTICS =================
ring_js="""function ring(parts,total,size){const r=48,c=2*Math.PI*r;let off=0;
  return '<svg viewBox="0 0 120 120" width="'+size+'" height="'+size+'" aria-hidden="true"><circle cx="60" cy="60" r="'+r+'" fill="none" stroke="var(--grid)" stroke-width="12"/>'+parts.map(p=>{const len=total?p[0]/total*c:0,sv='<circle cx="60" cy="60" r="'+r+'" fill="none" stroke="'+p[1]+'" stroke-width="12" stroke-dasharray="'+len.toFixed(2)+' '+(c-len).toFixed(2)+'" stroke-dashoffset="'+(-off).toFixed(2)+'" transform="rotate(-90 60 60)"/>';off+=len;return len>0?sv:''}).join('')+'</svg>'}
"""
a=s.index("function vToday(){");b=s.index("\n}\n",a)+3
orig=s[a:b]
pre=orig[:orig.index("  h+='<div class=\"stack\">';")]
body=(H/'redesign_today_body.js').read_text(encoding='utf-8')
s=s[:a]+ring_js+pre+body+"}\n"+s[b:]
ins_before("function insOver(A,C){",(H/'redesign_analytics.js').read_text(encoding='utf-8')+"\n")
import re
rep_tabs=re.search(r"const INS_TABS=\[[^\n]*\];",s)
assert rep_tabs
s=s.replace(rep_tabs.group(0),"const INS_TABS=[['dash','لوحة القيادة'],['demand','الطلب'],['plan','التصنيع'],['stuck','الواقف'],['health','صحة المخزون'],['team','الفريق']];")
rep("demand:insDemand,plan:insPlan,","demand:insDemand2,plan:insPlan2,")
rep("function vInsights(){\n  const C=ctx()","function vInsights(){\n  if(UI.ins==='rate')UI.ins='plan';if(UI.ins==='over')UI.ins='dash';\n  const C=ctx()")
rep("INS_TABS.some(t=>t[0]===UI.ins)?UI.ins:'over'","INS_TABS.some(t=>t[0]===UI.ins)?UI.ins:'dash'")
rep("""'<div class="seg" role="group" aria-label="الفترة">'+INS_PER.map(""","""(['dash','demand','team'].indexOf(T)<0?'<span class="pill" data-tip="الصفحة دي لقطة من حالة المخزون والأوردرات دلوقتي، مش مرتبطة بفترة">لقطة دلوقتي</span>':'')+'<div class="seg" role="group" aria-label="الفترة"'+(['dash','demand','team'].indexOf(T)<0?' hidden':'')+'>'+INS_PER.map(""")
rep("  more:()=>{UI.sheet={kind:'more'};render()},","  more:()=>{UI.sheet={kind:'more'};render()},\n  plx:el=>{UI.insX=UI.insX||{};UI.insX[el.dataset.m]=!UI.insX[el.dataset.m];render()},")
css3=r"""<style>
/* ----- today: hero ----- */
.hero{display:grid;grid-template-columns:auto minmax(0,1fr) minmax(240px,300px);gap:22px;align-items:center;padding:20px 22px}
.rwrap{position:relative;width:128px;height:128px}
.rc{position:absolute;inset:0;display:grid;place-content:center;text-align:center}
.rc b{font:600 26px/1 var(--f-mono)}.rc small{color:var(--muted);font-size:12px}
.hhead{font:500 20px/1.35 var(--f-disp)}.hhead b{font-weight:600}
.hlegend{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.hl{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border:1px solid var(--line);border-radius:99px;background:var(--surface);cursor:pointer;font-size:13px}
.hl:hover:not([disabled]){border-color:var(--accent);background:var(--lav)}.hl[disabled]{opacity:.5;cursor:default}
.hl .dot{width:9px;height:9px}
.hside{display:grid;gap:10px;border-inline-start:1px solid var(--line);padding-inline-start:20px}
.hmoney{display:grid;gap:6px}
.hmoney>div{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.hmoney small{color:var(--muted)}.hmoney b{font:600 15px var(--f-mono)}
.spk{display:flex;align-items:flex-end;gap:4px;height:38px;direction:ltr}
.spk .b{flex:1;display:flex;align-items:flex-end;height:100%}
.spk .b i{display:block;width:100%;border-radius:4px 4px 1px 1px;background:var(--line2)}
.spk .b.now i{background:var(--c-ready)}
.tsplit{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr)}
.t3{align-items:start}
.tl{display:grid}
.tli{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid var(--grid)}
.tli:last-child{border-bottom:0}
.tb{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:var(--lav);color:var(--accent)}
.tb svg{width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.tb.good{background:var(--good-bg);color:var(--good)}.tb.info{background:var(--info-bg);color:var(--info)}.tb.warn{background:var(--warn-bg);color:var(--warn)}.tb.lost{background:var(--lost-bg);color:var(--lost)}
.tt{display:grid;gap:1px;min-width:0}.tt b{font-weight:600}.tt small{font-size:12px}
.tq{font-size:14px}
.emp{display:grid;gap:5px;padding:8px 0;border-bottom:1px solid var(--grid)}.emp:last-of-type{border-bottom:0}
.col .b .lb{font-size:10px}.col .b:not(:nth-child(3n+1)):not(:last-child) .lb{visibility:hidden}
/* ----- analytics: plan table ----- */
.rb.m{position:relative;overflow:visible;width:90px}
.rb.m b{position:absolute;inset-inline-start:var(--x);top:-3px;bottom:-3px;width:2px;background:var(--ink);opacity:.55;border-radius:2px}
.plt .mrow{cursor:pointer}.plt .chev{color:var(--muted);text-align:center;transition:transform .2s}.plt .mrow.open .chev{transform:rotate(-90deg);color:var(--accent)}.plt .mrow.open>td{background:var(--lav)}
.plt>tbody>tr.mopen>td{background:var(--surface);padding:8px 14px 14px}
.skt{width:100%;border-collapse:collapse}.skt th{font-size:12px;color:var(--muted);font-weight:600;padding:6px 10px;text-align:start;border-bottom:1px solid var(--line)}.skt td{padding:7px 10px;border-bottom:1px solid var(--grid)}.skt tr[data-a]{cursor:pointer}.skt tr[data-a]:hover td{background:var(--lav)}
.skt td.num,.skt th.num{text-align:center}
@media (max-width:1000px){.hero{grid-template-columns:auto minmax(0,1fr)}.hside{grid-column:1/-1;border-inline-start:0;padding-inline-start:0;border-top:1px solid var(--line);padding-top:14px}.tsplit{grid-template-columns:minmax(0,1fr)}}
@media (max-width:820px){
  .hero{grid-template-columns:1fr;justify-items:center;text-align:center;padding:16px}
  .hhead{font-size:17px}.hlegend{justify-content:center;gap:6px}.hl{padding:5px 10px;font-size:12.5px}.hside{width:100%}
  .hero{gap:10px;padding:14px}.rwrap{width:96px;height:96px}.rwrap svg{width:100%;height:100%}.rc b{font-size:21px}.hmoney b{font-size:14px}
  .plt th:nth-child(3),.plt td:nth-child(3),.plt th:nth-child(5),.plt td:nth-child(5),.plt th:nth-child(7),.plt td:nth-child(7){display:none}
  .plt tr.mopen,.plt tr.mopen>td{display:block;width:100%}
}
</style>
"""
i=s.index('<div id="app"></div>')
s=s[:i]+css3+s[i:]

(T/'base_v2.html').write_text(s,encoding='utf-8')
print('5 ok')
