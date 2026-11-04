# executed from 5_redesign.py (uses s, rep, ins_before, H)
ins_before("function vStock(){",(H/'redesign_returns.js').read_text(encoding='utf-8')+"\n")
rep("if(type==='RTN')d.hdr={channel:'VENDOOR',codes:'',counted:false,unk:[],refs:[],sheet:null};","if(type==='RTN')d.hdr={channel:'VENDOOR',codes:'',counted:false,unk:[],refs:[],sheet:null,parcels:[],extra:[],msgs:[]};")
rep("const o=orderByRef(ref);if(o&&!o.rt)o.rt={doc:d.no,date:d.date}});","const o=orderByRef(ref);if(o&&!o.rt)o.rt=rtnOutcome(d,o)});")
# remove the codes textarea card; parcels UI replaces the aggregated line table for new return documents
a=s.index("  if(d.type==='RTN'&&draft)h+='<section class=\"card\"><h2>المتوقع رجوعه</h2>")
b=s.index("\n",a)
s=s[:a]+s[b+1:]
rep("""    h+='<section class="card"><h2>الأصناف</h2>'+(draft?picker(d)+'<div style="height:12px"></div>':'')+lineTable(d)+'</section>';""","""    h+=(d.type==='RTN'&&!(d.lines.length&&!(d.hdr.parcels&&d.hdr.parcels.length))?rtnParcels(d,draft):'<section class="card"><h2>الأصناف</h2>'+(draft?picker(d)+'<div style="height:12px"></div>':'')+lineTable(d)+'</section>');""")
rep("""    if(d.type==='RTN')h+='<label class="row" style="margin-top:12px;gap:8px"><input type="checkbox" data-c="rtncounted" '""","""    if(d.type==='RTN'&&!(H.parcels&&H.parcels.length))h+='<label class="row" style="margin-top:12px;gap:8px"><input type="checkbox" data-c="rtncounted" '""")
rep("return pill('warn','اتشحن · رجع','رجع في '+o.rt.doc+' ('+o.rt.date+')');","return pill(o.rt.miss?'crit':'warn',o.rt.miss?'اتشحن · رجع ناقص '+o.rt.miss:'اتشحن · رجع','رجع في '+o.rt.doc+' ('+o.rt.date+')'+(o.rt.exp!=null?' · استلمنا '+o.rt.got+' من '+o.rt.exp:''));")
rep("    if(o.st==='open')body+='<div class=\"row\"><button class=\"btn danger sm\" data-a=\"cxorder\"","    if(o.rt)body+=rtnOrderBlock(o);\n    if(o.st==='open')body+='<div class=\"row\"><button class=\"btn danger sm\" data-a=\"cxorder\"")
rep("Object.assign(ACT,ACT_ACC,ACT_LG);Object.assign(CHG,CHG_LG);","Object.assign(ACT,ACT_ACC,ACT_LG,ACT_RT);Object.assign(CHG,CHG_LG,CHG_RT);")
csr="""<style>
.rpc{padding:16px 18px;margin-bottom:12px}.rpl{display:grid;gap:2px}
.rpi{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--grid);flex-wrap:wrap}.rpi:first-child{border-top:0}
.rpn{display:inline-flex;align-items:center;gap:6px;min-width:0}
.rps button{padding:6px 11px;font-size:12.5px}
.rps button[aria-pressed=true].rs-r{background:var(--good-bg);color:var(--good);box-shadow:0 0 0 1px var(--good-line)}
.rps button[aria-pressed=true].rs-d{background:var(--warn-bg);color:var(--warn);box-shadow:0 0 0 1px var(--warn-line)}
.rps button[aria-pressed=true].rs-x{background:var(--crit-bg);color:var(--crit);box-shadow:0 0 0 1px var(--crit-line)}
.rps button[aria-pressed=true].rs-m{background:var(--lost-bg);color:var(--lost);box-shadow:0 0 0 1px var(--lost-bg)}
.rps button:disabled{cursor:default}
@media (max-width:820px){.rpi{flex-direction:column;align-items:stretch}.rps{display:flex}.rps button{flex:1;text-align:center;min-height:38px}}
</style>
"""
_i=s.index('<div id="app"></div>')
s=s[:_i]+csr+s[_i:]
