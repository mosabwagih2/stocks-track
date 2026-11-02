"""Builds apps/standard-edition/index.html (single self-contained file) from the parts in this folder.
Usage: python3 build.py"""
import os
here=os.path.dirname(os.path.abspath(__file__))
rd=lambda n:open(os.path.join(here,n),encoding='utf-8').read()
s1=rd('std_s1.txt')
a="function dirty(){QC=null;AG=null;save()}"
assert s1.count(a)==1
s1=s1.replace(a,"var DMC=null;\nfunction dirty(){QC=null;AG=null;DMC=null;save()}")
head='''<title>Femini WMS</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
<style>
'''+rd('std_css.txt')+'''</style>
<div id="app"></div>
<script>
(function(){
'use strict';
'''
js=s1+rd('std_s2.txt')+rd('std_s3.txt')+rd('std_s4.txt')+"\n})();\n</script>\n"
out=(head+js).replace('__DATA__',rd('data.json'))
dst=os.path.join(here,'..','..','apps','standard-edition','index.html')
open(dst,'w',encoding='utf-8').write(out)
print('built',dst,len(out))
