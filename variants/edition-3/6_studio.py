# Studio layer on top of Brand 2: restyle (studio.css) + stage animation on the demo tab. Output: apps/edition-3-brand-v2-copy
import pathlib
H=pathlib.Path(__file__).parent
src=(H.parent.parent/'apps'/'edition-3-brand-v2'/'index.html').read_text(encoding='utf-8')
css=(H/'studio.css').read_text(encoding='utf-8')
def rep(a,b,s):
    assert s.count(a)==1,(a[:60],s.count(a));return s.replace(a,b)
s=src
i=s.index('<div id="app"></div>')
s=s[:i]+'<style id="studio">\n'+css+'</style>\n'+s[i:]
stage='''function demoStage(){
  const cur='<svg viewBox="0 0 18 18"><path d="M2 1l12 7-5.2 1.4L6.6 15z" fill="#111" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg>';
  return '<section class="card"><h2>الدورة في 9 ثواني <span class="hint">ديمو متحرك</span></h2><div class="stg" role="img" aria-label="سكان أوردر: الحالة تتغير إلى اتشحن، الرصيد ينزل بقطعة، والفلاير يتخصم"><div class="stg-win"><div class="stg-bar"><i></i><i></i><i></i><span>العمليات · سكان</span></div><div class="stg-body"><div class="stg-list">'
   +'<div class="stg-row r1"><b>ed1042</b><span>BR2 · احمر · L</span><em><u class="a">مستني</u><u class="b">اتشحن</u></em></div>'
   +'<div class="stg-row"><b>nn1177</b><span>PAN5 · اسود · M</span><em><u class="a">مستني</u></em></div>'
   +'<div class="stg-row"><b>az1203</b><span>A6 · بيج · XL</span><em><u class="a">مستني</u></em></div></div>'
   +'<div class="stg-side"><div class="stg-k"><small>جاهز للبيع · BR2 احمر L</small><div class="stg-roll"><b class="a">12</b><b class="b">11</b></div></div><div class="stg-k"><small>فلاير الشحن · بيتخصم أوتوماتيك</small><div class="stg-bar2"><i></i></div></div></div></div>'
   +'<div class="stg-btn">ارفع ملف السكان</div><div class="stg-cur">'+cur+'</div></div><p class="stg-cap">السكان هو اللي بيخصم من الرصيد، والطلب (البيك أب) بيحجز بس. نفس الضغطة بتخصم المستلزمات.</p></div></section>';
}
'''
s=rep("function vDemo(){",stage+"function vDemo(){",s)
s=rep("let h='<section class=\"card\"><h2>داتا تجريبية","let h=demoStage()+'<section class=\"card\"><h2>داتا تجريبية",s)
s=rep('<title>Fémini Stock Brand 2</title>','<title>Fémini Stock Brand 2 (Copy)</title>',s) if '<title>Fémini Stock Brand 2</title>' in s else s
o=H.parent.parent/'apps'/'edition-3-brand-v2-copy';o.mkdir(exist_ok=True);(o/'index.html').write_text(s,encoding='utf-8')
print('6 ok',len(s))
