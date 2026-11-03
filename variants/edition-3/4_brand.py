import base64,re
import pathlib,os
H=pathlib.Path(__file__).parent
body=(H/'.work'/os.environ.get('BASE','base.html')).read_text(encoding='utf-8')
A=str(H/'assets')+'/'
b64=lambda f:base64.b64encode(open(A+f,'rb').read()).decode()
import base64 as _b
_d=lambda f:'data:image/png;base64,'+_b.b64encode(open(f,'rb').read()).decode()
bust=_d(str(H/'assets'/'lg_bust.png'));word=_d(str(H/'assets'/'lg_word.png'))
mark='data:image/png;base64,'+b64('femini-mark.png')

old='<div class="brand"><i>F</i><div><b>Fémini</b><small>Stock · مخزن</small></div></div>'
assert body.count(old)==1
body=body.replace(old,'<div class="brand"><img class="bm" src="'+bust+'" alt=""><div class="bt"><img class="bw" src="'+word+'" alt="Fémini"><small>Stock · مخزن</small></div></div>')
body=body.replace('<title>Fémini Stock</title>','<title>'+os.environ.get('TITLE','Fémini Stock Brand')+'</title>',1)

L="""--page:#faf9fd;--surface:#ffffff;--lav:#f3f0f9;--ink:#1f1738;--accent:#43316f;--on-accent:#ffffff;--muted:#655e80;
  --line:#e5e0f0;--line2:#d3cbe6;--grid:#eeeaf6;--rail:#2b2150;--on-rail:#f1edfb;--rail-mute:#b9afdc;--shadow:0 1px 2px rgba(43,33,80,.07),0 10px 26px -14px rgba(43,33,80,.25);
  --crit:#9e2f3a;--crit-bg:#fbeaec;--crit-line:#f0c5ca;--warn:#86581a;--warn-bg:#fbf1dd;--warn-line:#ecd7a8;
  --good:#1d6a4a;--good-bg:#e9f4ef;--good-line:#c3e0d2;--info:#3b5aa8;--info-bg:#ebeffa;--info-line:#c4cfec;--lost:#8f3768;--lost-bg:#f8e8f1;
  --c-ready:#3b9e84;--c-dirty:#d4a04a;--c-scrap:#cd5b66;--c-factory:#6a7fd1;--c-lost:#b26a9b;--swb:#cfc8de;"""
Dk="""--page:#130f20;--surface:#1b1630;--lav:#241d3d;--ink:#ece8f8;--accent:#bfaff0;--on-accent:#1d1438;--muted:#a9a2c4;
  --line:#2d2649;--line2:#453c6a;--grid:#292241;--rail:#0f0b1d;--on-rail:#f1edfb;--rail-mute:#9f96c6;
  --crit:#f4a0a8;--crit-bg:#3a1a22;--crit-line:#6b2d38;--warn:#efc27a;--warn-bg:#33270f;--warn-line:#6b501c;
  --good:#73d3a5;--good-bg:#12302a;--good-line:#246650;--info:#9db4f0;--info-bg:#16224a;--info-line:#2d4488;--lost:#e3a9cb;--lost-bg:#35172b;
  --c-ready:#4cb897;--c-dirty:#e0ad56;--c-scrap:#df6d78;--c-factory:#7a8fe0;--c-lost:#c47fae;--swb:#5a5280;color-scheme:dark"""
css=f"""<style>
/* Brand pass: same layout and components; only the logo and color tokens change. Everything derives from the logo purple #43316f. */
:root{{{L}}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{{Dk}}}}}
:root[data-theme="dark"]{{{Dk}}}
.brand{{gap:11px;padding:4px 10px 18px}}
.brand .bm{{height:40px;width:auto;display:block;flex:none}}
.brand .bt{{display:grid;gap:5px;min-width:0}}
.brand .bw{{width:92px;height:auto;display:block}}
.brand small{{letter-spacing:.03em;line-height:1}}
.nav .bd{{background:var(--c-scrap)}}
.chip[aria-pressed=true],.mi[aria-current=true]{{background:var(--accent);color:var(--on-accent);border-color:var(--accent)}}
.rail{{background-image:linear-gradient(180deg,rgba(255,255,255,.03),rgba(0,0,0,.14))}}
</style>
<script>(function(){{try{{var l=document.createElement('link');l.rel='icon';l.href='{mark}';document.head.appendChild(l);var m=document.createElement('meta');m.name='theme-color';m.content='#2b2150';document.head.appendChild(m)}}catch(e){{}}}})()</script>
"""
i=body.index('<div id="app"></div>')
body=body[:i]+css+body[i:]

tog_css=(H/"tog.html").read_text(encoding="utf-8")
i=body.index('<div id="app"></div>')
body=body[:i]+tog_css+body[i:]

_o=H.parent.parent/'apps'/os.environ.get('OUTDIR','edition-3-brand');_o.mkdir(exist_ok=True);(_o/'index.html').write_text(body,encoding='utf-8')
print(len(body))
