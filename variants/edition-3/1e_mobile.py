import pathlib
H=pathlib.Path(__file__).parent;T=H/'.work'
s=(T/'base.html').read_text(encoding='utf-8')
def rep(a,b):
    global s
    assert s.count(a)==1,(a[:80],s.count(a))
    s=s.replace(a,b)

# ---- bottom bar: 5 main tabs + "More" ----
rep("const NAV=[","const SEC={supplies:1,insights:1,ledger:1,files:1,config:1};\nconst NAV=[")
rep("""'<button class="nav" data-a="go" data-t="'+n[0]+'" '""","""'<button class="nav'+(SEC[n[0]]?' sec':'')+'" data-a="go" data-t="'+n[0]+'" '""")
rep("""</button>').join('')+'<div class="sp"></div>""","""</button>').join('')+'<button class="nav more" data-a="more" '+(SEC[UI.tab]?'aria-current="page"':'')+' aria-label="المزيد"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg><span>المزيد</span>'+(Object.keys(SEC).reduce((a,k)=>a+(b[k]||0),0)?'<span class="bd" aria-hidden="true"><span class="bn">'+Object.keys(SEC).reduce((a,k)=>a+(b[k]||0),0)+'</span></span>':'')+'</button><div class="sp"></div>""")
rep("  }else if(s.kind==='state'){","""  }else if(s.kind==='more'){
    const bd=badges();title='المزيد';
    body='<div class="opgrid" style="grid-template-columns:1fr 1fr">'+NAV.filter(n=>SEC[n[0]]).map(n=>'<button class="op mini" data-a="go" data-t="'+n[0]+'"><span class="ic">'+ic(n[0])+'</span><b>'+n[1]+(bd[n[0]]?' <span class="pill crit" style="margin-inline-start:4px">'+bd[n[0]]+'</span>':'')+'</b></button>').join('')+'</div><button class="btn" data-a="theme">◐ المظهر: '+({system:'تلقائي',light:'فاتح',dark:'داكن'})[theme]+'</button><p class="muted" style="font-size:12px">'+esc(S.actor)+' · نسخة تجريبية</p>';
  }else if(s.kind==='state'){""")
rep("  state:el=>{UI.sheet={kind:'state',l:el.dataset.l};render()},","  state:el=>{UI.sheet={kind:'state',l:el.dataset.l};render()},\n  more:()=>{UI.sheet={kind:'more'};render()},")

# ---- table hooks (mobile hides low-value columns) ----
rep('<table><thead><tr><th style="width:36px"></th><th>كود الأوردر</th>','<table class="ordtbl"><thead><tr><th style="width:36px"></th><th>كود الأوردر</th>')
rep('<table class="t-sm"><thead><tr><th>التاريخ</th><th>المستند</th>','<table class="t-sm ledtbl"><thead><tr><th>التاريخ</th><th>المستند</th>')


for a,b in [("h+='<div class=\"chips\" style=\"margin-bottom:14px\">'+INTERNAL.map","h+='<div class=\"chips scrollx\" style=\"margin-bottom:14px\">'+INTERNAL.map"),
 ("<div class=\"chips\">'+[['all','كل الموديلات']]","<div class=\"chips scrollx\">'+[['all','كل الموديلات']]"),
 ("<div class=\"chips\">'+[['all','الكل'],['low'","<div class=\"chips scrollx\">'+[['all','الكل'],['low'"),
 ("<div class=\"chips\">'+F.map(f=>'<button class=\"chip\" aria-pressed=\"'+(UI.opF","<div class=\"chips scrollx\">'+F.map(f=>'<button class=\"chip\" aria-pressed=\"'+(UI.opF"),
 ("<div class=\"chips\">'+[['all','الكل']].concat(LINE_ORDER.map","<div class=\"chips scrollx\">'+[['all','الكل']].concat(LINE_ORDER.map")]:
    rep(a,b)

rep("<aside class=\"sheet\" role=\"dialog\"","<aside class=\"sheet'+(s.kind==='more'?' compact':'')+'\" role=\"dialog\"")

# ---- stock toolbar: compact on phones ----
rep("""'المخزون','كل صنف (موديل × لون × مقاس) وحالته. اضغط أي خانة تفتح تفاصيلها.',""","""'المخزون','<span class="hm">كل صنف (موديل × لون × مقاس) وحالته. اضغط أي خانة تفتح تفاصيلها.</span>',""")
rep("""data-a="ssort" data-v="alpha">أبجدي</button></div>';""","""data-a="ssort" data-v="alpha">أبجدي</button></div><button type="button" class="sortbtn" data-a="ssort" data-v="'+(s.sort==='alpha'?'pull':'alpha')+'" aria-label="تغيير الترتيب">⇅ '+(s.sort==='alpha'?'أبجدي':'الأكتر سحبًا')+'</button>';""")

# ---- nav badges: severity colors, dot on phones ----
rep("""(b[n[0]]?'<span class="bd">'+b[n[0]]+'</span>':'')""","""(b[n[0]]?'<span class="bd'+(n[0]==='ops'?' warn':'')+'" aria-hidden="true"><span class="bn">'+b[n[0]]+'</span></span><span class="sr">'+(n[0]==='today'?'، '+b[n[0]]+' تنبيه حرج':n[0]==='orders'?'، '+b[n[0]]+' أوردر هيقف':n[0]==='stock'?'، '+b[n[0]]+' صنف بالسالب':'، '+b[n[0]]+' مسودة')+'</span>':'')""")

css=r"""<style>
/* Phone layout (<=820px). Desktop is untouched. */
.nav.more{display:none}
.sortbtn{display:none}
.nav .bd.warn{background:#e3a93f;color:#2b2150}
@media (max-width:820px){
  body{font-size:15px}
  .nav.sec{display:none}
  .nav.more{display:flex}
  .nav{flex:1 1 0;min-width:0;padding:7px 4px}
  .nav .bd{position:absolute;margin:0;top:5px;inset-inline-end:auto;right:calc(50% - 21px);width:10px;height:10px;padding:0;border-radius:99px;box-sizing:content-box;border:2px solid var(--rail);font-size:0}
  .nav .bd .bn{display:none}
  .main{padding-top:16px;padding-bottom:112px}
  .top{gap:10px;margin-bottom:14px}
  .top h1{font-size:22px}
  .top .sub{font-size:13px;line-height:1.5}
  .top .tools{margin-inline-start:0;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .top .tools>.pill{grid-column:1/-1;justify-self:start}
  .top .tools>.seg{grid-column:1/-1;display:flex}
  .top .tools>.seg button{flex:1;text-align:center;padding:9px 6px}
  .top .tools>.btn{justify-content:center}
  .btn{min-height:42px}.btn.sm{min-height:36px}
  .chip{padding:8px 14px;min-height:36px}
  input,select,textarea{font-size:16px;min-height:42px}
  input[type=checkbox]{min-height:0;width:20px;height:20px}
  input[type=number]{width:84px}
  .card{padding:14px;border-radius:14px}
  .kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .kpi{padding:12px}.kpi b{font-size:24px}
  .tabs button{padding:10px 12px}
  .opgrid{grid-template-columns:1fr;gap:8px}
  .op{grid-template-columns:auto minmax(0,1fr);column-gap:12px;align-items:center;padding:12px}
  .op .ic{grid-row:1/3;margin-bottom:0}
  .op em{display:none}
  .op.mini{grid-template-columns:auto minmax(0,1fr)}
  .op.mini .ic{grid-row:auto}
  /* tables: one line per row, scroll sideways, drop low-value columns */
  .tw{-webkit-overflow-scrolling:touch}
  th,td{white-space:nowrap}
  .ordtbl th:nth-child(3),.ordtbl td:nth-child(3),.ordtbl th:nth-child(4),.ordtbl td:nth-child(4),.ordtbl th:nth-child(5),.ordtbl td:nth-child(5){display:none}
  .ledtbl th:nth-child(2),.ledtbl td:nth-child(2),.ledtbl th:nth-child(7),.ledtbl td:nth-child(7){display:none}
  /* stock matrix: every size fits without sideways scroll */
  .card:has(.mx){padding:10px 6px}
  .tw:has(.mx){border:0;background:none;border-radius:0;overflow:visible}
  .mx{width:100%;border-spacing:2px}
  .mx th{padding:3px 0;font-size:11px}
  .mx .cl{padding:0 4px 0 2px;font-size:12px}
  .cell{min-width:0;width:100%;height:44px;font-size:12.5px;border-radius:8px;letter-spacing:-.02em}
  .cell small{font-size:8.5px}
  .top .sub:has(>.hm:only-child){display:none}
  .top{margin-bottom:10px}
  .top .tools>.seg button{padding:10px 6px;font-size:14px}
  .top .tools>.btn{min-height:40px}
  .chips.scrollx{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin-inline:-16px;padding-inline:16px;padding-block:2px}
  .chips.scrollx .chip{padding:7px 13px;font-size:13px}
  .row>.chips.scrollx{margin-inline:0;padding-inline:0}
  .seg[aria-label="الترتيب"]{display:none}
  .sortbtn{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;flex:none;cursor:pointer;min-height:36px;padding:0 12px;border:1px solid var(--line2);border-radius:99px;background:var(--surface);font-size:13px;font-weight:500;white-space:nowrap}
  .sortbtn:active{background:var(--lav)}
  #sq{min-width:0!important;max-width:none!important;width:100%}
  .row:has(#sq)>.chips.scrollx{flex:1 1 100%}
  .chips.scrollx::-webkit-scrollbar{display:none}
  .chips.scrollx .chip{flex:none}
  .row>.chips.scrollx{flex:1 1 0;min-width:0}
  .sheet.compact{top:auto;bottom:0;max-height:75%;height:auto;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 70px)}
  /* sheets */
  .sheet>header{padding:14px 16px}
  .sheet>header .x{min-height:40px}
  .sheet>div.body{overscroll-behavior:contain}
  .scrim{backdrop-filter:blur(2px)}
}
</style>
"""
i=s.index('<div id="app"></div>')
s=s[:i]+css+s[i:]
(T/'base.html').write_text(s,encoding='utf-8')
print('1e ok')
