import pathlib
r=pathlib.Path(__file__).parent
rd=lambda n:(r/n).read_text(encoding='utf-8')
body='\n'.join(rd(n) for n in ['p2_engine.js','p3_docs.js','p3b_sup.js','p3c_files.js','p3d_catalog.js','p3e_cancel.js','p4a_views.js','p4b_views.js','p4c_views.js','p4d_insights.js','p5_app.js'])
src=rd('p1_head.html')+'<div id="app"></div>\n<script>\n'+body+'\n</script>\n'
out=r.parent.parent/'apps'/'edition-3'
(out/'index.html').write_text(src.replace('__DATA__',rd('data.json')),encoding='utf-8')
print(len(src))
