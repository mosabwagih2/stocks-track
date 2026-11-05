import pathlib
H=pathlib.Path(__file__).parent
T=H/'.work'
T.mkdir(exist_ok=True)
src=(T/'base.html').read_text(encoding='utf-8')
body=src
tog=(H/'tog.html').read_text(encoding='utf-8')
i=body.index('<div id="app"></div>')
(H.parent.parent/'apps'/'edition-3'/'index.html').write_text(body[:i]+tog+body[i:],encoding='utf-8')
