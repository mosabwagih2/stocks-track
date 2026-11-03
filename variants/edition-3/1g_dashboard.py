import pathlib
H=pathlib.Path(__file__).parent;T=H/'.work'
s=(T/'base.html').read_text(encoding='utf-8')
def rep(a,b):
    global s
    assert s.count(a)==1,(a[:80],s.count(a))
    s=s.replace(a,b)
js=(H/'dashboard.js').read_text(encoding='utf-8')
rep("function insOver(A,C){",js+"\nfunction insOver(A,C){")
rep("const INS_TABS=[['over','نظرة عامة'],","const INS_TABS=[['dash','لوحة القيادة'],['over','نظرة عامة'],")
rep("h+=({over:insOver,","h+=({dash:insDash,over:insOver,")
rep("ins:'over',insP","ins:'dash',insP")
rep("['30','30 يوم'],['all','كل البيانات']]","['30','30 يوم'],['90','90 يوم'],['all','كل البيانات']]")
rep("  }else if(s.kind==='more'){","""  }else if(s.kind==='oos'){
    const Dd=dashData();title='أصناف خلصت وعليها طلب ('+Dd.oos.length+')';
    body=Dd.oos.length?'<div class="msg">دي أصناف رصيدها صفر أو بالسالب وبتتباع (أو عليها طلب مفتوح). "ضايع/أسبوع" = معدل السحب × 7، يعني الطلب اللي هيتأخر لحد ما ترجع.</div><div class="tw"><table class="t-sm"><thead><tr><th>الصنف</th><th class="num">طلب مفتوح</th><th class="num">ضايع/أسبوع</th></tr></thead><tbody>'+Dd.oos.slice(0,60).map(x=>'<tr data-a="sku" data-sku="'+x.id+'"><td>'+thumb(SKU.get(x.id).m,26)+' '+sw(SKU.get(x.id).c)+' '+esc(skuName(x.id))+'</td><td class="num">'+N(x.dm)+'</td><td class="num">'+N(Math.round(x.rd*7))+'</td></tr>').join('')+'</tbody></table></div><button class="btn pri" data-a="oosplan">افتح اقتراح التصنيع</button>':'<div class="msg good">مفيش أصناف خلصت وعليها طلب.</div>';
  }else if(s.kind==='more'){""")
rep("  more:()=>{UI.sheet={kind:'more'};render()},","  more:()=>{UI.sheet={kind:'more'};render()},\n  oos:()=>{UI.sheet={kind:'oos'};render()},\n  oosplan:()=>{UI.sheet=null;UI.ins='plan';go('insights')},")
css="""<style>
.wk.dense{gap:3px}.wk.dense .p{gap:1px}.wk.dense .p i{width:5px}.wk.dense .l{font-size:10px}
.kpi b:has(.cur){font-size:24px}.kpi b .cur{font:500 13px var(--f-ar);margin-inline-start:5px;color:var(--muted)}
</style>
"""
i=s.index('<div id="app"></div>')
s=s[:i]+css+s[i:]
(T/'base.html').write_text(s,encoding='utf-8')
print('1g ok')
