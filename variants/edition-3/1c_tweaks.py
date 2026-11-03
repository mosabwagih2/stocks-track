import pathlib,re
H=pathlib.Path(__file__).parent;T=H/'.work'
s=(T/'state2.html').read_text(encoding='utf-8')
# remove the pencil badge on model thumbnails (hover border and tooltip stay)
s,n=re.subn(r"\.imgbtn::after\{[^}]*\}\n?","",s)
assert n==1,n
(T/'state2.html').write_text(s,encoding='utf-8')
