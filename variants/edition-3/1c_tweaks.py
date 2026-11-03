import pathlib,re
H=pathlib.Path(__file__).parent;T=H/'.work'
s=(T/'state2.html').read_text(encoding='utf-8')
# remove the pencil badge on model thumbnails (hover border and tooltip stay)
s,n=re.subn(r"\.imgbtn::after\{[^}]*\}\n?","",s)
assert n==1,n
# test hook: expose the real logic (read-only use in tests)
old="window.__F={S:()=>S,UI,go,ctx,g,dirty,render,rollCheck};"
assert s.count(old)==1
s=s.replace(old,"window.__F={S:()=>S,UI,go,ctx,g,dirty,render,rollCheck,newDoc,addLine,confirmDoc,reverseDoc,build,cxApply,planRows,lowList,consumption,supStatus,orderByRef,actions,locSum,info,rateData,stateBar,ACT};")
(T/'state2.html').write_text(s,encoding='utf-8')
